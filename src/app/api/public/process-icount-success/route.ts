import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processCompletedOrder } from "@/app/api/webhooks/icount/route";

// POST /api/public/process-icount-success
// Fallback: processes iCount payment from success page redirect params
// Idempotent — safe to call multiple times (checks pendingOrder.status)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pendingOrderId, docnum, doc_url, total, confirmation_code, customer_id, cp } = body;

    if (!pendingOrderId) {
      return NextResponse.json({ error: "Missing pendingOrderId" }, { status: 400 });
    }

    // Fetch pending order — idempotency check
    const pendingOrder = await prisma.pendingOrder.findUnique({
      where: { id: pendingOrderId },
    });

    if (!pendingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
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
    });

    return NextResponse.json({ status: "processed" });
  } catch (error) {
    console.error("Process iCount success error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
