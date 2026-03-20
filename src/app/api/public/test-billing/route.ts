import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBillingClient } from "@/lib/billing";

// GET /api/public/test-billing — temporary debug endpoint
export async function GET() {
  try {
    const billing = await getBillingClient();
    if (!billing) {
      return NextResponse.json({ error: "No billing provider" });
    }

    const testResult = await billing.client.testConnection();

    // Simulate what create-payment does: DB write before payment
    const setType = await prisma.setType.findUnique({ where: { id: "cmm6n1h3d000cus9gris7z6uh" } });
    const pendingOrder = await prisma.pendingOrder.create({
      data: {
        stripeSessionId: `test_${Date.now()}`,
        fullName: "Test User",
        phone: "0501234567",
        email: "test@test.com",
        organId: "cmm6n1f7a0003us9gemcaitbt",
        setTypeId: "cmm6n1h3d000cus9gris7z6uh",
        isUpdateOnly: false,
        amount: Number(setType?.price || 3000),
        infoFileData: Buffer.from("dummy"),
        infoFileName: "test.n27",
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.AUTH_URL || "";
    let paymentResult: unknown = null;
    try {
      const page = await billing.client.createPaymentPage({
        customer: { name: "Test User", email: "test@test.com", phone: "0501234567" },
        items: [{ description: `רכישת סט ${setType?.name || "בסיס"}`, quantity: 1, unitPrice: 3000 }],
        successUrl: `${baseUrl}/order/success`,
        cancelUrl: `${baseUrl}/order/cancel`,
        webhookUrl: `${baseUrl}/api/webhooks/yeshinvoice`,
        autoCreateDoc: true,
        docType: "invoice_receipt",
        metadata: { pendingOrderId: pendingOrder.id },
      });
      paymentResult = { success: true, url: page.url };
    } catch (e) {
      paymentResult = { success: false, error: e instanceof Error ? e.message : String(e) };
    }

    // Cleanup
    await prisma.pendingOrder.delete({ where: { id: pendingOrder.id } });

    return NextResponse.json({
      provider: billing.provider.provider,
      testConnection: testResult,
      orderId: pendingOrder.id,
      createPayment: paymentResult,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) });
  }
}
