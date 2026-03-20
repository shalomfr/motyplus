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

    // Try createPayment directly with minimal data
    let paymentResult: unknown = null;
    try {
      const page = await billing.client.createPaymentPage({
        customer: { name: "Test", email: "test@test.com", phone: "0500000000" },
        items: [{ description: "Test", quantity: 1, unitPrice: 1 }],
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/cancel",
        webhookUrl: "https://example.com/webhook",
        autoCreateDoc: false,
        docType: "receipt",
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
