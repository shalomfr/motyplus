import { NextResponse } from "next/server";
import { getBillingClient } from "@/lib/billing";

// GET /api/public/test-billing — temporary debug endpoint
export async function GET() {
  try {
    const billing = await getBillingClient();
    if (!billing) {
      return NextResponse.json({ error: "No billing provider" });
    }

    // Test connection
    const testResult = await billing.client.testConnection();

    // Try createPayment with REAL parameters (same as create-payment route)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.AUTH_URL || "";
    let paymentResult: unknown = null;
    try {
      const page = await billing.client.createPaymentPage({
        customer: { name: "Test User", email: "test@test.com", phone: "0501234567" },
        items: [{ description: "רכישת סט בסיס", quantity: 1, unitPrice: 3000 }],
        successUrl: `${baseUrl}/order/success`,
        cancelUrl: `${baseUrl}/order/cancel`,
        webhookUrl: `${baseUrl}/api/webhooks/yeshinvoice`,
        autoCreateDoc: true,
        docType: "invoice_receipt",
        metadata: { pendingOrderId: "test123" },
      });
      paymentResult = { success: true, url: page.url };
    } catch (e) {
      paymentResult = { success: false, error: e instanceof Error ? e.message : String(e) };
    }

    return NextResponse.json({
      provider: billing.provider.provider,
      testConnection: testResult,
      createPayment: paymentResult,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) });
  }
}
