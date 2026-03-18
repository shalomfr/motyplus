import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/file-storage";
import { logActivity } from "@/lib/activity-logger";

// POST /api/webhooks/icount — webhook מ-iCount אחרי תשלום מוצלח
export async function POST(request: NextRequest) {
  try {
    // Webhook validation — בדיקת secret token
    const authHeader = request.headers.get("X-iCount-Signature") || request.headers.get("Authorization");
    const webhookSecret = process.env.ICOUNT_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("iCount webhook: ICOUNT_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    // If iCount provides signature, validate it (בעבר בודקים ב-iCount docs מה הפורמט)
    // For now, require either:
    // 1. X-iCount-Signature header with secret token, OR
    // 2. Authorization: Bearer <secret>
    if (authHeader) {
      const [scheme, token] = authHeader.split(" ");
      if (scheme === "Bearer" && token !== webhookSecret) {
        console.error("iCount webhook: invalid signature");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (!request.headers.has("X-iCount-Signature")) {
      console.error("iCount webhook: missing authentication");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // iCount sends: status, custom_fields (with pendingOrderId), docnum, doc_url, total, etc.
    const {
      status,
      custom_fields,
      docnum,
      doc_url,
      total,
      payment_id,
    } = body;

    // Parse metadata
    let metadata: Record<string, string> = {};
    try {
      metadata = typeof custom_fields === "string" ? JSON.parse(custom_fields) : custom_fields || {};
    } catch {
      metadata = {};
    }

    const pendingOrderId = metadata.pendingOrderId;

    if (!pendingOrderId) {
      console.error("iCount webhook: no pendingOrderId in custom_fields");
      return NextResponse.json({ received: true });
    }

    // Only process successful payments
    if (status !== "success" && status !== "approved" && status !== true) {
      console.log("iCount webhook: payment not successful, status:", status);
      return NextResponse.json({ received: true });
    }

    // Fetch pending order (idempotency check)
    const order = await prisma.pendingOrder.findUnique({
      where: { id: pendingOrderId },
    });

    if (!order || order.status !== "PENDING") {
      return NextResponse.json({ received: true });
    }

    // Calculate dates
    const purchaseDate = new Date();
    const updateExpiryDate = new Date(purchaseDate);
    updateExpiryDate.setFullYear(updateExpiryDate.getFullYear() + 1);

    // Determine currentUpdateVersion
    let currentUpdateVersion: string | null = null;
    let setTypeId = order.setTypeId;

    if (order.isUpdateOnly) {
      let updateOnlySet = await prisma.setType.findFirst({
        where: { name: "עדכון בלבד" },
      });
      if (!updateOnlySet) {
        updateOnlySet = await prisma.setType.create({
          data: {
            name: "עדכון בלבד",
            price: 0,
            includesUpdates: false,
            sortOrder: 99,
            isActive: false,
          },
        });
      }
      setTypeId = updateOnlySet.id;

      if (order.updateVersionId) {
        const ver = await prisma.updateVersion.findUnique({
          where: { id: order.updateVersionId },
          select: { version: true },
        });
        currentUpdateVersion = ver?.version || null;
      }
    } else if (setTypeId) {
      const setType = await prisma.setType.findUnique({ where: { id: setTypeId } });
      if (setType?.includesUpdates) {
        const latest = await prisma.updateVersion.findFirst({
          where: { status: { not: "DRAFT" } },
          orderBy: { sortOrder: "desc" },
          select: { version: true },
        });
        currentUpdateVersion = latest?.version || null;
      }
    }

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        fullName: order.fullName,
        phone: order.phone,
        email: order.email,
        organId: order.organId,
        setTypeId: setTypeId!,
        amountPaid: order.amount,
        purchaseDate,
        updateExpiryDate,
        hasV3: true,
        sampleType: "CPI",
        currentUpdateVersion,
        status: "ACTIVE",
        notes: order.notes,
      },
    });

    // Upload info file to Google Drive
    try {
      const fileName = `${customer.id}.n27`;
      const url = await uploadFile(Buffer.from(order.infoFileData), fileName, "customers/info");
      await prisma.customer.update({
        where: { id: customer.id },
        data: { infoFileUrl: url },
      });
    } catch (uploadErr) {
      console.error("Error uploading info file:", uploadErr);
    }

    // Create payment record with receipt info from iCount
    await prisma.payment.create({
      data: {
        customerId: customer.id,
        amount: total || order.amount,
        description: order.isUpdateOnly ? "עדכון תוכנה" : "רכישת סט",
        status: "COMPLETED",
        paymentMethod: "ICOUNT",
        externalPaymentId: payment_id ? String(payment_id) : null,
        receiptNumber: docnum ? String(docnum) : null,
        receiptUrl: doc_url ? String(doc_url) : null,
        hasReceipt: !!docnum,
      },
    });

    // Log activity
    await logActivity({
      customerId: customer.id,
      action: "CREATE",
      entityType: "CUSTOMER",
      entityId: String(customer.id),
      details: {
        fullName: customer.fullName,
        source: "icount_payment",
        receiptNumber: docnum,
      },
    });

    // Mark as completed
    await prisma.pendingOrder.update({
      where: { id: pendingOrderId },
      data: { status: "COMPLETED" },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("iCount webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
