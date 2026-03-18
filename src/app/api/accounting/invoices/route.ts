import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createICountClient } from "@/lib/icount";
import { decrypt } from "@/lib/crypto";
import { logActivity } from "@/lib/activity-logger";
import type { ICountSettings, ICountDocumentType } from "@/lib/icount";

async function getICountClient() {
  const provider = await prisma.billingProvider.findFirst({
    where: { provider: "ICOUNT", isActive: true, isPrimary: true },
  });
  if (!provider) return null;

  const companyId = decrypt(provider.apiKey);
  const credentials = provider.apiSecret ? decrypt(provider.apiSecret) : "";
  const settings = (provider.settings as ICountSettings) || {};

  return { client: createICountClient(companyId, credentials, settings), provider };
}

// GET /api/accounting/invoices — רשימת מסמכים מ-iCount
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה. יש להתחבר למערכת" }, { status: 401 });
    }

    const icount = await getICountClient();
    if (!icount) {
      return NextResponse.json(
        { error: "לא הוגדר חיבור ל-iCount. יש להגדיר ספק חיוב בהגדרות" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate") || undefined;
    const toDate = searchParams.get("toDate") || undefined;
    const doctype = searchParams.get("doctype")
      ? parseInt(searchParams.get("doctype")!)
      : undefined;

    const docs = await icount.client.getDocuments({
      ...(doctype ? { doctype } : {}),
      ...(fromDate ? { from_date: fromDate } : {}),
      ...(toDate ? { to_date: toDate } : {}),
    });

    return NextResponse.json(docs);
  } catch (error) {
    console.error("Error fetching invoices from iCount:", error);
    return NextResponse.json({ error: "שגיאה בטעינת מסמכים מ-iCount" }, { status: 500 });
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

    // אימות פריטים
    for (const item of items) {
      if (!item.description || !item.quantity || !item.unitprice) {
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
      items: items.map((item: { description: string; quantity: number; unitprice: number }) => ({
        description: item.description,
        quantity: item.quantity,
        unitprice: item.unitprice,
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
