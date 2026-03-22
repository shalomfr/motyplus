import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/file-storage";
import { logActivity } from "@/lib/activity-logger";
import type { ICountIpnPayload } from "@/lib/icount";

// POST /api/webhooks/icount — webhook מ-iCount
// תומך בשני מצבים:
// 1. Document webhook (סעיף 22) — כשמופק מסמך
// 2. IPN / Payment page webhook (סעיף 22א) — כשמתקבל תשלום בעמוד סליקה
export async function POST(request: NextRequest) {
  try {
    // Webhook validation — בדיקת secret token
    const webhookSecret = process.env.ICOUNT_WEBHOOK_SECRET;

    if (webhookSecret) {
      // Check query param secret (sent by create-payment route)
      const url = new URL(request.url);
      const querySecret = url.searchParams.get("secret");

      // Check header-based auth
      const authHeader = request.headers.get("X-iCount-Signature") || request.headers.get("Authorization");

      let authenticated = false;

      // Option 1: query param match
      if (querySecret && querySecret === webhookSecret) {
        authenticated = true;
      }
      // Option 2: Bearer header match
      if (authHeader) {
        const [scheme, token] = authHeader.split(" ");
        if (scheme === "Bearer" && token === webhookSecret) {
          authenticated = true;
        }
      }
      // Option 3: X-iCount-Signature header present (iCount's own auth)
      if (request.headers.has("X-iCount-Signature")) {
        authenticated = true;
      }

      if (!authenticated) {
        console.error("iCount webhook: authentication failed");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = (await request.json()) as ICountIpnPayload;

    // Determine webhook type
    const isPaymentPageWebhook = body.cp !== undefined || body.custom_fields !== undefined;

    if (isPaymentPageWebhook) {
      return handlePaymentPageWebhook(body);
    } else {
      return handleDocumentWebhook(body);
    }
  } catch (error) {
    console.error("iCount webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}

/**
 * Handle payment page (עמוד סליקה) webhooks from iCount
 * Triggered when a payment is received on an iCount payment page.
 * Reference: Section 22א (IPN) in iCount-api-docs-index.md
 */
async function handlePaymentPageWebhook(payloadBody: ICountIpnPayload) {
  try {
    const {
      status,
      custom_fields,
      docnum,
      doc_url,
      total,
      payment_id,
      cp,
      customer_email,
      customer_name,
      client_id,
    } = payloadBody;

    // Parse metadata from custom_fields
    let paymentMetadata: Record<string, string> = {};
    try {
      paymentMetadata = typeof custom_fields === "string" ? JSON.parse(custom_fields) : (custom_fields as Record<string, string>) || {};
    } catch {
      paymentMetadata = {};
    }

    const pendingOrderId = paymentMetadata.pendingOrderId;

    if (!pendingOrderId) {
      console.log("iCount webhook: no pendingOrderId in custom_fields, might be payment confirmation");
      return NextResponse.json({ received: true });
    }

    // Only process successful payments
    const isSuccess = status === "success" || status === "approved" || String(status) === "true";
    if (!isSuccess) {
      console.log("iCount webhook: payment not successful, status:", status);
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

    // Create customer (with iCount client_id if provided)
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
        icountClientId: client_id ? String(client_id) : null,
      },
    });

    // Upload info file to Google Drive
    try {
      const fileName = `${customer.id}.n27`;
      const url = await uploadFile(Buffer.from(pendingOrder.infoFileData), fileName, "customers/info");
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
        amount: total || pendingOrder.amount,
        description: pendingOrder.isUpdateOnly ? "עדכון תוכנה" : "רכישת סט",
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
        paymentPageId: cp,
      },
    });

    // Mark as completed
    await prisma.pendingOrder.update({
      where: { id: pendingOrderId },
      data: { status: "COMPLETED" },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("iCount payment page webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}

/**
 * Handle document webhooks from iCount
 * Triggered when a document is issued in iCount.
 * Reference: Section 22 (WebHooks) in icount-api-docs-index.md
 *
 * This webhook is useful for:
 * - Updating receipt info for existing payments
 * - Auditing document creation
 * - Syncing document metadata
 */
async function handleDocumentWebhook(body: ICountIpnPayload) {
  try {
    const {
      doctype,
      docnum,
      doc_link,
      pdf_link,
      totalwithvat,
      totalsum,
      clientname,
      dateissued,
    } = body;

    // Log the document webhook for auditing
    console.log("iCount document webhook:", {
      doctype,
      docnum,
      doclink: doc_link,
      clientname,
      dateissued,
    });

    // Check if this document already exists in our system
    if (docnum) {
      const existingPayment = await prisma.payment.findFirst({
        where: { receiptNumber: String(docnum) },
      });

      if (existingPayment) {
        // Update receipt URL if not already set
        if (!existingPayment.receiptUrl && doc_link) {
          await prisma.payment.update({
            where: { id: existingPayment.id },
            data: {
              receiptUrl: String(doc_link),
              hasReceipt: true,
            },
          });

          // Log the update
          if (existingPayment.customerId) {
            await logActivity({
              customerId: existingPayment.customerId,
              action: "UPDATE",
              entityType: "PAYMENT",
              entityId: existingPayment.id,
              details: {
                receiptNumber: docnum,
                receiptUrl: doc_link,
                doctype,
              },
            });
          }
        }
      }
    }

    // Webhook received and processed
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("iCount document webhook error:", error);
    // Don't fail the webhook — iCount expects success
    return NextResponse.json({ received: true });
  }
}
