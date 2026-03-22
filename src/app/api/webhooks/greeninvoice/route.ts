import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/file-storage";
import { logActivity } from "@/lib/activity-logger";

// POST /api/webhooks/greeninvoice — webhook מ-Green Invoice (morning)
// נקרא ע"י notifyUrl אחרי תשלום בדף סליקה
export async function POST(request: NextRequest) {
  try {
    // אימות webhook — בדיקת secret token ב-query string
    const webhookSecret = process.env.GREENINVOICE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const token = request.nextUrl.searchParams.get("secret");
      if (token !== webhookSecret) {
        console.error("Green Invoice webhook: invalid secret token");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await request.json();

    console.log("Green Invoice webhook received:", {
      id: body.id,
      type: body.type,
      number: body.number,
      status: body.status,
      custom: body.custom,
    });

    // Parse metadata from custom field
    let metadata: Record<string, string> = {};
    try {
      if (body.custom) {
        metadata =
          typeof body.custom === "string"
            ? JSON.parse(body.custom)
            : body.custom;
      }
    } catch {
      metadata = {};
    }

    const pendingOrderId = metadata.pendingOrderId;
    if (!pendingOrderId) {
      console.log("Green Invoice webhook: no pendingOrderId in custom field");
      // Handle document-only notification
      await handleDocumentWebhook(body);
      return NextResponse.json({ received: true });
    }

    // Fetch pending order (idempotency check)
    const pendingOrder = await prisma.pendingOrder.findUnique({
      where: { id: pendingOrderId },
    });

    if (!pendingOrder || pendingOrder.status !== "PENDING") {
      return NextResponse.json({ received: true });
    }

    // Calculate dates
    const purchaseDate = new Date();
    const updateExpiryDate = new Date(purchaseDate);
    updateExpiryDate.setFullYear(updateExpiryDate.getFullYear() + 1);

    // Determine currentUpdateVersion
    let currentUpdateVersion: string | null = null;
    let setTypeId = pendingOrder.setTypeId;

    if (pendingOrder.isUpdateOnly) {
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

      if (pendingOrder.updateVersionId) {
        const ver = await prisma.updateVersion.findUnique({
          where: { id: pendingOrder.updateVersionId },
          select: { version: true },
        });
        currentUpdateVersion = ver?.version || null;
      }
    } else if (setTypeId) {
      const setType = await prisma.setType.findUnique({
        where: { id: setTypeId },
      });
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
        fullName: pendingOrder.fullName,
        phone: pendingOrder.phone,
        email: pendingOrder.email,
        organId: pendingOrder.organId,
        setTypeId: setTypeId!,
        amountPaid: pendingOrder.amount,
        purchaseDate,
        updateExpiryDate,
        hasV3: true,
        sampleType: "CPI",
        currentUpdateVersion,
        status: "ACTIVE",
        notes: pendingOrder.notes,
      },
    });

    // Upload info file to Google Drive
    try {
      const fileName = `${customer.id}.n27`;
      const url = await uploadFile(
        Buffer.from(pendingOrder.infoFileData),
        fileName,
        "customers/info"
      );
      await prisma.customer.update({
        where: { id: customer.id },
        data: { infoFileUrl: url },
      });
    } catch (uploadErr) {
      console.error("Error uploading info file:", uploadErr);
    }

    // Extract document info
    const docNumber = body.number ? String(body.number) : null;
    const docUrl = body.url?.he || body.url?.origin || null;
    const totalAmount = body.amount || pendingOrder.amount;

    // Create payment record
    await prisma.payment.create({
      data: {
        customerId: customer.id,
        amount: totalAmount,
        description: pendingOrder.isUpdateOnly ? "עדכון תוכנה" : "רכישת סט",
        status: "COMPLETED",
        paymentMethod: "GREEN_INVOICE",
        externalPaymentId: body.id ? String(body.id) : null,
        receiptNumber: docNumber,
        receiptUrl: docUrl ? String(docUrl) : null,
        hasReceipt: !!docNumber,
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
        source: "greeninvoice_payment",
        receiptNumber: docNumber,
      },
    });

    // Mark as completed
    await prisma.pendingOrder.update({
      where: { id: pendingOrderId },
      data: { status: "COMPLETED" },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Green Invoice webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 400 }
    );
  }
}

/**
 * Handle document-only webhooks (without pendingOrderId).
 */
async function handleDocumentWebhook(body: Record<string, unknown>) {
  const docNumber = body.number ? String(body.number) : null;
  if (!docNumber) return;

  const existingPayment = await prisma.payment.findFirst({
    where: { receiptNumber: docNumber },
  });

  if (existingPayment && !existingPayment.receiptUrl) {
    const docUrl =
      (body.url as { he?: string; origin?: string })?.he ||
      (body.url as { origin?: string })?.origin ||
      null;

    if (docUrl) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          receiptUrl: String(docUrl),
          hasReceipt: true,
        },
      });
    }

    if (existingPayment.customerId) {
      await logActivity({
        customerId: existingPayment.customerId,
        action: "UPDATE",
        entityType: "PAYMENT",
        entityId: existingPayment.id,
        details: {
          receiptNumber: docNumber,
          source: "greeninvoice_webhook",
        },
      });
    }
  }
}
