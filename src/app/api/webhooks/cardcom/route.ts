import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/file-storage";
import { logActivity } from "@/lib/activity-logger";

// POST /api/webhooks/cardcom — webhook מ-CardCom
// נקרא ע"י WebHookUrl אחרי תשלום בדף סליקה (LowProfile)
// CardCom שולח form-encoded parameters
export async function POST(request: NextRequest) {
  try {
    // אימות webhook — בדיקת secret token ב-query string
    const webhookSecret = process.env.CARDCOM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const token = request.nextUrl.searchParams.get("secret");
      if (token !== webhookSecret) {
        console.error("CardCom webhook: invalid secret token");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // CardCom שולח form-encoded data
    const text = await request.text();
    const params = new URLSearchParams(text);

    // Parse all parameters into an object
    const body: Record<string, string> = {};
    params.forEach((value, key) => {
      body[key] = value;
    });

    console.log("CardCom webhook received:", {
      ResponseCode: body.ResponseCode,
      DocNumber: body.DocNumber,
      DocType: body.DocType,
      ReturnValue: body.ReturnValue,
      InvoiceNumber: body.ExtReadInvoiceHead_InvoiceNumber,
    });

    // בדיקת הצלחה
    if (body.ResponseCode !== "0") {
      console.log("CardCom webhook: non-success ResponseCode:", body.ResponseCode);
      return NextResponse.json({ received: true });
    }

    // Parse metadata from ReturnValue
    let metadata: Record<string, string> = {};
    try {
      if (body.ReturnValue) {
        metadata = JSON.parse(body.ReturnValue);
      }
    } catch {
      metadata = {};
    }

    const pendingOrderId = metadata.pendingOrderId;
    if (!pendingOrderId) {
      console.log("CardCom webhook: no pendingOrderId in ReturnValue, document notification only");
      // Handle document-only webhook — update existing payment receipt
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

    // Extract promotionId from metadata
    const promoId = metadata.promotionId || null;

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
        promotionId: promoId || undefined,
      },
    });

    // Upload info files to Google Drive
    try {
      const fileName = `${customer.id}.n27`;
      const url = await uploadFile(
        Buffer.from(pendingOrder.infoFileData),
        fileName,
        "customers/info"
      );
      const updateData: Record<string, string> = { infoFileUrl: url };

      if (pendingOrder.additionalInfoFileData && pendingOrder.additionalInfoFileData.length > 0) {
        const addFileName = `${customer.id}_2.n27`;
        const addUrl = await uploadFile(
          Buffer.from(pendingOrder.additionalInfoFileData),
          addFileName,
          "customers/info"
        );
        updateData.additionalInfoFileUrl = addUrl;
      }

      await prisma.customer.update({
        where: { id: customer.id },
        data: updateData,
      });
    } catch (uploadErr) {
      console.error("Error uploading info file:", uploadErr);
    }

    // Extract document info from webhook
    const docNumber = body.ExtReadInvoiceHead_InvoiceNumber || body.DocNumber || null;
    const totalAmount = body.ExtReadInvoiceHead_TotalIncludeVAT
      ? parseFloat(body.ExtReadInvoiceHead_TotalIncludeVAT)
      : pendingOrder.amount;

    // Create payment record
    await prisma.payment.create({
      data: {
        customerId: customer.id,
        amount: totalAmount,
        description: pendingOrder.isUpdateOnly ? "עדכון תוכנה" : "רכישת סט",
        status: "COMPLETED",
        paymentMethod: "CARDCOM",
        externalPaymentId: body.DocNumber ? String(body.DocNumber) : null,
        receiptNumber: docNumber ? String(docNumber) : null,
        receiptUrl: null, // CardCom doesn't return URL in webhook — fetch later if needed
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
        source: "cardcom_payment",
        receiptNumber: docNumber,
        docType: body.DocType,
      },
    });

    // Mark as completed
    await prisma.pendingOrder.update({
      where: { id: pendingOrderId },
      data: { status: "COMPLETED" },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("CardCom webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}

/**
 * Handle document-only webhooks (without pendingOrderId).
 * Updates existing payment records with receipt info.
 */
async function handleDocumentWebhook(body: Record<string, string>) {
  const docNumber = body.ExtReadInvoiceHead_InvoiceNumber || body.DocNumber;
  if (!docNumber) return;

  const existingPayment = await prisma.payment.findFirst({
    where: { receiptNumber: String(docNumber) },
  });

  if (existingPayment && !existingPayment.receiptUrl) {
    // Try to get document URL if we have the number
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: { hasReceipt: true },
    });

    if (existingPayment.customerId) {
      await logActivity({
        customerId: existingPayment.customerId,
        action: "UPDATE",
        entityType: "PAYMENT",
        entityId: existingPayment.id,
        details: {
          receiptNumber: docNumber,
          docType: body.DocType,
          source: "cardcom_webhook",
        },
      });
    }
  }
}
