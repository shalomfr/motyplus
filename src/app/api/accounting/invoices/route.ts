import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getBillingClient } from "@/lib/billing";
import type { DocumentType } from "@/lib/billing";
import { logActivity } from "@/lib/activity-logger";

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

    // 1. שליפת מסמכים מספק חיוב
    const billing = await getBillingClient();
    if (billing) {
      try {
        const docs = await billing.client.getDocuments({
          docType: doctype,
          fromDate,
          toDate,
        });

        for (const doc of docs) {
          const docUrl = String(doc.doc_url || doc.pdfUrl || "");

          invoices.push({
            id: String(doc.docnum || doc.doc_id || ""),
            docNumber: String(doc.docnum || ""),
            docType: String(doc.doctype || ""),
            amount: Number(doc.totalwithvat || doc.total || 0),
            docUrl,
            pdfUrl: docUrl,
            createdAt: String(doc.dateissued || ""),
            customer: {
              id: Number(doc.client_id || 0),
              fullName: String(doc.client_name || `לקוח ${doc.client_id || ""}`),
            },
          });
        }
      } catch (err) {
        console.error("Error fetching docs from billing provider:", err);
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

    const validDocTypes: DocumentType[] = ["tax_invoice", "invoice_receipt", "quote"];
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

    const billing = await getBillingClient();
    if (!billing) {
      return NextResponse.json(
        { error: "לא הוגדר ספק חיוב. יש להגדיר ספק בהגדרות" },
        { status: 400 }
      );
    }

    // יצירת המסמך דרך ספק החיוב
    const result = await billing.client.createDocument({
      customer: {
        name: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        id: customer.icountClientId || undefined,
      },
      items: items.map((item: { description: string; quantity: number; unitprice?: number; unitPrice?: number }) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitprice ?? item.unitPrice ?? 0,
      })),
      docType: docType as DocumentType,
      sendEmail: true,
    });

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
    return NextResponse.json({ error: "שגיאה ביצירת מסמך" }, { status: 500 });
  }
}
