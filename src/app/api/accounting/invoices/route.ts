import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getICountClient } from "@/lib/icount";
import { logActivity } from "@/lib/activity-logger";
import type { ICountDocumentType } from "@/lib/icount";

// מיפוי doctype מספרי לשם
const doctypeNumberToName: Record<number, string> = {
  400: "receipt",
  305: "invoice",
  320: "invoice_receipt",
  330: "credit_note",
  10: "quote",
};

// GET /api/accounting/invoices — רשימת מסמכים (iCount + קבלות מקומיות)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה. יש להתחבר למערכת" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate") || undefined;
    const toDate = searchParams.get("toDate") || undefined;
    const doctype = searchParams.get("doctype") || undefined;

    const invoices: Array<{
      id: string;
      docNumber: string | null;
      docType: string;
      amount: number;
      docUrl: string | null;
      pdfUrl: string | null;
      createdAt: string;
      customer: { id: number; fullName: string };
    }> = [];

    // 1. שליפת מסמכים מ-iCount
    const icount = await getICountClient();
    if (icount) {
      try {
        const docs = await icount.client.getDocuments({
          ...(doctype ? { doctype } : {}),
          ...(fromDate ? { from_date: fromDate } : {}),
          ...(toDate ? { to_date: toDate } : {}),
        });

        const doctypeStringToLabel: Record<string, string> = {
          invoice: "חשבונית מס",
          receipt: "קבלה",
          invrec: "חשבונית מס-קבלה",
          offer: "הצעת מחיר",
        };

        for (const doc of docs) {
          const rawDoctype = String(doc.doctype || "");
          invoices.push({
            id: String(doc.doc_id || doc.docnum || ""),
            docNumber: String(doc.docnum || doc.doc_id || ""),
            docType: doctypeStringToLabel[rawDoctype] || doctypeNumberToName[Number(rawDoctype)] || rawDoctype,
            amount: Number(doc.total || doc.amount || 0),
            docUrl: String(doc.doc_url || ""),
            pdfUrl: String(doc.pdf_url || ""),
            createdAt: String(doc.dateissued || doc.date || doc.created_at || ""),
            customer: {
              id: Number(doc.client_id || 0),
              fullName: String(doc.client_name || doc.customer_name || `לקוח ${doc.client_id || ""}`),
            },
          });
        }
      } catch (err) {
        console.error("Error fetching docs from iCount:", err);
      }
    }

    // 2. שליפת קבלות מקומיות (שנוצרו דרך "הנפק קבלה")
    const receiptPayments = await prisma.payment.findMany({
      where: {
        hasReceipt: true,
        ...(fromDate ? { createdAt: { gte: new Date(fromDate) } } : {}),
        ...(toDate ? { createdAt: { lte: new Date(toDate) } } : {}),
      },
      include: { customer: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    });

    // הוספת קבלות שלא נמצאות כבר ברשימת iCount (לפי מספר קבלה)
    const existingDocNumbers = new Set(invoices.map((inv) => inv.docNumber));
    for (const payment of receiptPayments) {
      if (payment.receiptNumber && existingDocNumbers.has(payment.receiptNumber)) {
        // עדכון הלקוח במסמך הקיים מ-iCount עם מזהה מקומי
        const existing = invoices.find((inv) => inv.docNumber === payment.receiptNumber);
        if (existing && existing.customer.id === 0) {
          existing.customer = {
            id: payment.customer.id,
            fullName: payment.customer.fullName,
          };
        }
        continue;
      }

      invoices.push({
        id: payment.id,
        docNumber: payment.receiptNumber || null,
        docType: "receipt",
        amount: Number(payment.amount),
        docUrl: payment.receiptUrl || null,
        pdfUrl: payment.receiptUrl || null,
        createdAt: payment.createdAt.toISOString(),
        customer: {
          id: payment.customer.id,
          fullName: payment.customer.fullName,
        },
      });
    }

    // מיון לפי תאריך (חדש ראשון)
    invoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מסמכים" }, { status: 500 });
  }
}

// POST /api/accounting/invoices — יצירת חשבונית/הצעת מחיר ב-iCount
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה. יש להתחבר למערכת" }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, items, docType } = body;

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "חסרים שדות חובה (לקוח ופריטים)" },
        { status: 400 }
      );
    }

    const validDocTypes: ICountDocumentType[] = ["tax_invoice", "invoice_receipt", "quote"];
    if (!docType || !validDocTypes.includes(docType)) {
      return NextResponse.json(
        { error: "סוג מסמך לא תקין. אפשרויות: tax_invoice, invoice_receipt, quote" },
        { status: 400 }
      );
    }

    // אימות פריטים (accept both unitprice and unitPrice)
    for (const item of items) {
      const price = item.unitprice ?? item.unitPrice ?? 0;
      if (!item.description || !item.quantity || price <= 0) {
        return NextResponse.json(
          { error: "כל פריט חייב לכלול תיאור, כמות ומחיר" },
          { status: 400 }
        );
      }
    }

    // טעינת לקוח מה-DB
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }

    const icount = await getICountClient();
    if (!icount) {
      return NextResponse.json(
        { error: "לא הוגדר חיבור ל-iCount. יש להגדיר ספק חיוב בהגדרות" },
        { status: 400 }
      );
    }

    // יצירת המסמך ב-iCount
    const docRequest = {
      customer: {
        client_name: customer.fullName,
        email: customer.email,
        phone: customer.phone,
      },
      items: items.map((item: { description: string; quantity: number; unitprice?: number; unitPrice?: number }) => ({
        description: item.description,
        quantity: item.quantity,
        unitprice: item.unitprice ?? item.unitPrice ?? 0,
      })),
      docType: docType as ICountDocumentType,
      sendEmail: true,
    };

    let result;
    switch (docType) {
      case "tax_invoice":
        result = await icount.client.createInvoice(docRequest);
        break;
      case "invoice_receipt":
        result = await icount.client.createInvoiceReceipt(docRequest);
        break;
      case "quote":
        result = await icount.client.createQuote(docRequest);
        break;
      default:
        result = await icount.client.createInvoice(docRequest);
    }

    const docTypeLabels: Record<string, string> = {
      tax_invoice: "חשבונית מס",
      invoice_receipt: "חשבונית מס-קבלה",
      quote: "הצעת מחיר",
    };

    await logActivity({
      userId: session.user.id,
      customerId,
      action: `יצירת ${docTypeLabels[docType] || "מסמך"}`,
      entityType: "PAYMENT",
      entityId: result.id,
      details: {
        docType,
        docNumber: result.number,
        amount: result.amount,
      },
    });

    return NextResponse.json({
      id: result.id,
      number: result.number,
      url: result.url,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json({ error: "שגיאה ביצירת מסמך ב-iCount" }, { status: 500 });
  }
}
