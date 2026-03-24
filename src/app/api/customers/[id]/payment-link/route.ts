import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getBillingClient } from "@/lib/billing";
import { getCustomerBalanceDetails } from "@/lib/services/customer-balance.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { id } = await params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "מזהה לקוח לא תקין" }, { status: 400 });
    }

    const [customer, details, billing] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: { fullName: true, email: true, phone: true },
      }),
      getCustomerBalanceDetails(customerId),
      getBillingClient(),
    ]);

    if (!customer || !details) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }
    if (!billing) {
      return NextResponse.json({ error: "לא הוגדר ספק חיוב" }, { status: 503 });
    }
    if (details.totalOwed <= 0) {
      return NextResponse.json({ error: "אין יתרה לתשלום" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.AUTH_URL || "";

    const page = await billing.client.createPaymentPage({
      customer: { name: customer.fullName, email: customer.email, phone: customer.phone },
      items: [{ description: details.description, quantity: 1, unitPrice: details.totalOwed }],
      successUrl: `${baseUrl}/order/success`,
      cancelUrl: `${baseUrl}/order/cancel`,
      autoCreateDoc: true,
      docType: "invoice_receipt",
      metadata: { customerId: String(customerId), source: "balance_link" },
    });

    return NextResponse.json({
      url: page.url,
      amount: details.totalOwed,
      description: details.description,
    });
  } catch (error) {
    console.error("Error creating payment link:", error);
    return NextResponse.json({ error: "שגיאה ביצירת לינק תשלום" }, { status: 500 });
  }
}
