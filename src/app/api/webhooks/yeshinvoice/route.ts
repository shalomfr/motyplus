import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/file-storage";
import { logActivity } from "@/lib/activity-logger";

// POST /api/webhooks/yeshinvoice — webhook מ-יש חשבונית
// נקרא ע"י NotifyUrl אחרי תשלום בדף סליקה
export async function POST(request: NextRequest) {
  try {
    // אימות webhook — בדיקת secret token ב-query string
    const webhookSecret = process.env.YESHINVOICE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const token = request.nextUrl.searchParams.get("secret");
      if (token !== webhookSecret) {
        console.error("YeshInvoice webhook: invalid secret token");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await request.json();

    // Parse metadata from Fields1
    let metadata: Record<string, string> = {};
    try {
      if (body.Fields1) {
        metadata = typeof body.Fields1 === "string"
          ? JSON.parse(body.Fields1)
          : body.Fields1;
      }
    } catch {
      metadata = {};
    }

    const pendingOrderId = metadata.pendingOrderId;
    if (!pendingOrderId) {
      console.log("YeshInvoice webhook: no pendingOrderId in Fields1");
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
        icountClientId: body.CustomerID ? String(body.CustomerID) : null,
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

    // Create payment record
    const docNumber = body.docNumber ? String(body.docNumber) : null;
    const docUrl = body.pdfurl || body.url || null;

    await prisma.payment.create({
      data: {
        customerId: customer.id,
        amount: body.TotalPrice || pendingOrder.amount,
        description: pendingOrder.isUpdateOnly ? "עדכון תוכנה" : "רכישת סט",
        status: "COMPLETED",
        paymentMethod: "YESHINVOICE",
        externalPaymentId: body.OrderNumber ? String(body.OrderNumber) : null,
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
        source: "yeshinvoice_payment",
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
    console.error("YeshInvoice webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
