import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBillingClient } from "@/lib/billing";
import { getCustomerBalanceDetails } from "@/lib/services/customer-balance.service";

// GET /pay/[customerId] — payment method selection page
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

    const baseUrl = process.env.ORDER_FORM_URL || process.env.AUTH_URL || "";
    const amount = details.totalOwed;

    // Create payment links for each method
    const paymentRequest = {
      customer: { name: customer.fullName, email: customer.email, phone: customer.phone },
      items: [{ description: details.description, quantity: 1, unitPrice: amount }],
      successUrl: `${baseUrl}/order/success`,
      cancelUrl: `${baseUrl}/order/cancel`,
      autoCreateDoc: true,
      docType: "invoice_receipt" as const,
      metadata: { customerId: String(customerId), source: "pay_redirect" },
    };

    // Create all payment URLs in parallel
    const [creditUrl, bitUrl, googlePayUrl, applePayUrl] = await Promise.all([
      createPaymentWithGroup(billing, paymentRequest, undefined).catch(() => null),
      createPaymentWithGroup(billing, paymentRequest, 120).catch(() => null),
      createPaymentWithGroup(billing, paymentRequest, 150).catch(() => null),
      createPaymentWithGroup(billing, paymentRequest, 160).catch(() => null),
    ]);

    return paymentSelectionPage(customer.fullName, amount, {
      credit: creditUrl,
      bit: bitUrl,
      googlePay: googlePayUrl,
      applePay: applePayUrl,
    });
  } catch (error) {
    console.error("Error in pay redirect:", error);
    return errorPage("שגיאה ביצירת לינק תשלום");
  }
}

async function createPaymentWithGroup(
  billing: Awaited<ReturnType<typeof getBillingClient>>,
  request: Parameters<NonNullable<Awaited<ReturnType<typeof getBillingClient>>>["client"]["createPaymentPage"]>[0],
  group?: number
): Promise<string | null> {
  if (!billing) return null;
  const page = await billing.client.createPaymentPage({ ...request, group });
  return page.url || null;
}

function paymentSelectionPage(
  name: string,
  amount: number,
  urls: { credit: string | null; bit: string | null; googlePay: string | null; applePay: string | null }
) {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>תשלום — מוטי רוזנפלד</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; min-height: 100vh; display: flex; align-items: center; justify-content: center; direction: rtl; padding: 20px; }
  .card { background: #fff; border-radius: 16px; padding: 32px; max-width: 420px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { text-align: center; margin-bottom: 24px; }
  .header h1 { font-size: 1.3rem; color: #1a1a2e; margin-bottom: 4px; }
  .header .amount { font-size: 2rem; font-weight: 700; color: #2563eb; }
  .header .name { font-size: 0.9rem; color: #888; margin-top: 4px; }
  .methods { display: flex; flex-direction: column; gap: 12px; }
  .method { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-radius: 12px; border: 2px solid #e8ecf4; text-decoration: none; color: #333; font-size: 1rem; font-weight: 600; transition: all 0.2s; }
  .method:hover { border-color: #2563eb; background: #f8faff; transform: translateY(-1px); }
  .method .icon { font-size: 1.5rem; width: 36px; text-align: center; }
  .icon-img { width: 36px; height: 36px; object-fit: contain; border-radius: 6px; }
  .method .label { flex: 1; }
  .method .arrow { color: #ccc; font-size: 1.2rem; }
  .method.credit { border-color: #2563eb; background: #f8faff; }
  .method.bit { }
  .method.disabled { opacity: 0.4; pointer-events: none; }
  .footer { text-align: center; margin-top: 20px; font-size: 0.75rem; color: #aaa; }
  .installments { font-size: 0.8rem; color: #888; font-weight: 400; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>תשלום</h1>
    <div class="amount">₪${amount.toLocaleString("he-IL")}</div>
    <div class="name">${name}</div>
  </div>
  <div class="methods">
    ${urls.credit ? `<a href="${urls.credit}" class="method credit">
      <img class="icon-img" src="https://cdn-icons-png.flaticon.com/512/196/196578.png" alt="credit card">
      <span class="label">כרטיס אשראי <span class="installments">עד 6 תשלומים</span></span>
      <span class="arrow">←</span>
    </a>` : ""}
    ${urls.bit ? `<a href="${urls.bit}" class="method bit">
      <img class="icon-img" src="https://play-lh.googleusercontent.com/Ob9H0wWbDjTSMcqjiVOag8aFmQTqDOynYpElx4DIdnGBsNGZtfaFPK4sd_DZRBhjAw=w480-h960" alt="bit">
      <span class="label">ביט</span>
      <span class="arrow">←</span>
    </a>` : ""}
    ${urls.applePay ? `<a href="${urls.applePay}" class="method">
      <img class="icon-img" src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Apple_Pay_logo.svg/512px-Apple_Pay_logo.svg.png" alt="Apple Pay">
      <span class="label">Apple Pay</span>
      <span class="arrow">←</span>
    </a>` : ""}
    ${urls.googlePay ? `<a href="${urls.googlePay}" class="method">
      <img class="icon-img" src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Google_Pay_Logo.svg/512px-Google_Pay_Logo.svg.png" alt="Google Pay">
      <span class="label">Google Pay</span>
      <span class="arrow">←</span>
    </a>` : ""}
  </div>
  <div class="footer">תשלום מאובטח — מוטי רוזנפלד</div>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
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
