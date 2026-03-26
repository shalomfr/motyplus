import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processCompletedOrder } from "@/app/api/webhooks/icount/route";

// POST /api/public/process-icount-success
// Fallback: processes iCount payment from success page redirect params
// Idempotent — safe to call multiple times (checks pendingOrder.status)
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const body = await request.json();
    const { pendingOrderId, docnum, doc_url, total, confirmation_code, customer_id, cp, promotionId } = body;

    if (!pendingOrderId) {
      return NextResponse.json({ error: "Missing pendingOrderId" }, { status: 400 });
    }

    // Extract token from body or query params
    const token = body.token || searchParams.get("token");

    // Fetch pending order — idempotency check
    const pendingOrder = await prisma.pendingOrder.findUnique({
      where: { id: pendingOrderId },
    });

    if (!pendingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Basic security: verify the token matches the payment session
    // Soft check — if no token is provided, we still allow it (backward compatibility)
    if (token && pendingOrder.paymentSessionId && token !== pendingOrder.paymentSessionId) {
      return NextResponse.json({ error: "אימות נכשל" }, { status: 403 });
    }

    if (pendingOrder.status !== "PENDING") {
      // Already processed (by webhook or previous call)
      return NextResponse.json({ status: "already_processed" });
    }

    await processCompletedOrder(pendingOrder, {
      docnum: docnum ? String(docnum) : null,
      docUrl: doc_url ? String(doc_url) : null,
      total: total ? Number(total) : null,
      paymentId: confirmation_code ? String(confirmation_code) : null,
      clientId: customer_id ? String(customer_id) : null,
      cp: cp ? String(cp) : null,
    }, promotionId ? String(promotionId) : null);

    return NextResponse.json({ status: "processed" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Process iCount success error:", msg, error);
    return NextResponse.json({ error: `Processing failed: ${msg}` }, { status: 500 });
  }
}
