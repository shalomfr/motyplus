import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBillingClient } from "@/lib/billing";
import { getCustomerBalanceDetails } from "@/lib/services/customer-balance.service";

// GET /pay/[customerId] — public redirect: creates fresh payment link and redirects
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) {
      return errorPage("מזהה לקוח לא תקין");
    }

    const [customer, details, billing] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: { fullName: true, email: true, phone: true },
      }),
      getCustomerBalanceDetails(customerId),
      getBillingClient(),
    ]);

    if (!customer) {
      return errorPage("לקוח לא נמצא");
    }
    if (!billing) {
      return errorPage("שירות התשלום אינו זמין כרגע");
    }
    if (!details || details.totalOwed <= 0) {
      return errorPage("אין יתרה לתשלום");
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.AUTH_URL || "";

    const page = await billing.client.createPaymentPage({
      customer: { name: customer.fullName, email: customer.email, phone: customer.phone },
      items: [{ description: details.description, quantity: 1, unitPrice: details.totalOwed }],
      successUrl: `${baseUrl}/order/success`,
      cancelUrl: `${baseUrl}/order/cancel`,
      autoCreateDoc: true,
      docType: "invoice_receipt",
      metadata: { customerId: String(customerId), source: "pay_redirect" },
    });

    if (!page.url) {
      return errorPage("שגיאה ביצירת דף תשלום");
    }

    return NextResponse.redirect(page.url);
  } catch (error) {
    console.error("Error in pay redirect:", error);
    return errorPage("שגיאה ביצירת לינק תשלום");
  }
}

function errorPage(message: string) {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>שגיאה</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;direction:rtl}
.card{background:#fff;border-radius:12px;padding:40px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.1);max-width:400px}
h1{color:#e53e3e;font-size:1.3rem;margin-bottom:8px}
p{color:#666;font-size:0.95rem}</style>
</head>
<body><div class="card"><h1>⚠️</h1><h1>${message}</h1><p>אם הבעיה חוזרת, פנה לתמיכה</p></div></body>
</html>`;
  return new NextResponse(html, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
