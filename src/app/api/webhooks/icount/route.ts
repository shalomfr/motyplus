import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { uploadFile } from "@/lib/file-storage";
import { logActivity } from "@/lib/activity-logger";

// POST /api/webhooks/icount — webhook מ-iCount
// תומך בשני מצבים:
// 1. Document webhook (סעיף 22) — כשמופק מסמך
// 2. IPN / Payment page webhook (סעיף 22א) — כשמתקבל תשלום בעמוד סליקה
export async function POST(request: NextRequest) {
  try {
    // Webhook validation — בדיקת secret token
    const webhookSecret = process.env.ICOUNT_WEBHOOK_SECRET;

    if (webhookSecret) {
      const url = new URL(request.url);
      const querySecret = url.searchParams.get("secret");
      const authHeader = request.headers.get("X-iCount-Signature") || request.headers.get("Authorization");

      let authenticated = false;
      if (querySecret && querySecret === webhookSecret) authenticated = true;
      if (authHeader) {
        const [scheme, token] = authHeader.split(" ");
        if (scheme === "Bearer" && token === webhookSecret) authenticated = true;
      }
      if (request.headers.has("X-iCount-Signature")) authenticated = true;

      if (!authenticated) {
        console.error("iCount webhook: authentication failed");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // iCount can send data as JSON or form-encoded — handle both
    const body = await parseRequestBody(request);

    console.log("iCount webhook received:", JSON.stringify(body).slice(0, 500));

    // Determine webhook type — payment page IPN has cp or custom fields
    const isPaymentPageWebhook = body.cp !== undefined || body.custom_fields !== undefined || body.confirmation_code !== undefined;

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
 * Parse request body — supports JSON, form-encoded, and multipart
 */
async function parseRequestBody(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await request.json();
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const body: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      body[key] = value;
    }
    // Parse custom[{json}] format from iCount
    const customFields = extractCustomFields(body);
    if (customFields) {
      body.custom_fields = customFields;
    }
    return body;
  }

  // Try JSON first, fall back to text parsing
  try {
    return await request.json();
  } catch {
    const text = await request.text();
    // Parse as URL-encoded
    const params = new URLSearchParams(text);
    const body: Record<string, unknown> = {};
    for (const [key, value] of params.entries()) {
      body[key] = value;
    }
    const customFields = extractCustomFields(body);
    if (customFields) {
      body.custom_fields = customFields;
    }
    return body;
  }
}

/**
 * Extract pendingOrderId from iCount's custom field format
 * iCount returns m__ prefixed fields without the prefix in IPN
 * Also supports: custom[{json}], custom_fields, direct fields
 */
function extractCustomFields(body: Record<string, unknown>): Record<string, string> | null {
  // Check for m__ prefixed fields (iCount returns them without prefix in IPN)
  // e.g., m__pendingOrderId → pendingOrderId in IPN
  const result: Record<string, string> = {};

  // Direct fields (iCount strips m__ prefix in IPN)
  if (body.pendingOrderId) {
    result.pendingOrderId = String(body.pendingOrderId);
  }
  if (body.promotionId) {
    result.promotionId = String(body.promotionId);
  }

  // Check for m__ prefixed fields (in case iCount doesn't strip them)
  for (const key of Object.keys(body)) {
    if (key.startsWith("m__")) {
      result[key.slice(3)] = String(body[key]);
    }
  }

  if (result.pendingOrderId) return result;

  // Check for standard custom_fields
  if (body.custom_fields) {
    try {
      return typeof body.custom_fields === "string"
        ? JSON.parse(body.custom_fields)
        : body.custom_fields as Record<string, string>;
    } catch {
      // continue to other formats
    }
  }

  // Check for custom[{json}] format — legacy fallback
  for (const key of Object.keys(body)) {
    if (key.startsWith("custom[") || key.startsWith("custom%5B")) {
      const match = key.match(/custom[\[%5B](.+?)[\]%5D]/i);
      if (match) {
        try {
          const decoded = decodeURIComponent(match[1]);
          return JSON.parse(decoded);
        } catch {
          try {
            return JSON.parse(match[1]);
          } catch { /* skip */ }
        }
      }
    }
  }

  return null;
}

/**
 * Handle payment page (עמוד סליקה) webhooks from iCount
 */
async function handlePaymentPageWebhook(body: Record<string, unknown>) {
  try {
    const cp = body.cp;
    const docnum = body.docnum as string | undefined;
    const doc_url = body.doc_url as string | undefined;
    const total = body.total || body.sum || body.total_paid;
    const payment_id = body.payment_id || body.confirmation_code;
    const customer_name = body.customer_name as string | undefined;
    const customer_email = body.customer_email as string | undefined;
    const client_id = body.client_id || body.customer_id;

    // Parse metadata — try multiple sources
    let pendingOrderId: string | null = null;
    const customFields = body.custom_fields as Record<string, string> | null;
    if (customFields?.pendingOrderId) {
      pendingOrderId = customFields.pendingOrderId;
    }
    if (!pendingOrderId && body.pendingOrderId) {
      pendingOrderId = String(body.pendingOrderId);
    }
    if (!pendingOrderId && body.m__pendingOrderId) {
      pendingOrderId = String(body.m__pendingOrderId);
    }

    if (!pendingOrderId) {
      console.log("iCount webhook: no pendingOrderId found, body keys:", Object.keys(body).join(", "));
      return NextResponse.json({ received: true });
    }

    // iCount IPN is only sent on successful payments — no need to check status
    // But verify if present
    const status = body.status as string | undefined;
    if (status && !["success", "approved", "true", "1"].includes(String(status))) {
      console.log("iCount webhook: payment not successful, status:", status);
      return NextResponse.json({ received: true });
    }

    // Fetch pending order (idempotency check)
    const pendingOrder = await prisma.pendingOrder.findUnique({
      where: { id: pendingOrderId },
    });

    if (!pendingOrder || pendingOrder.status !== "PENDING") {
      console.log("iCount webhook: order already processed or not found:", pendingOrderId);
      return NextResponse.json({ received: true });
    }

    await processCompletedOrder(pendingOrder, {
      docnum: docnum ? String(docnum) : null,
      docUrl: doc_url ? String(doc_url) : null,
      total: total ? Number(total) : null,
      paymentId: payment_id ? String(payment_id) : null,
      clientId: client_id ? String(client_id) : null,
      cp: cp ? String(cp) : null,
    }, customFields?.promotionId || null);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("iCount payment page webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}

/**
 * Process a completed order — shared between webhook and success page callback
 */
export async function processCompletedOrder(
  pendingOrder: {
    id: string;
    fullName: string;
    phone: string;
    email: string;
    organId: string;
    setTypeId: string | null;
    updateVersionId: string | null;
    isUpdateOnly: boolean;
    amount: unknown;
    infoFileData: Uint8Array;
    infoFileName: string;
    additionalInfoFileData: Uint8Array | null;
    additionalInfoFileName: string | null;
    notes: string | null;
  },
  payment: {
    docnum: string | null;
    docUrl: string | null;
    total: number | null;
    paymentId: string | null;
    clientId: string | null;
    cp: string | null;
  },
  promotionId?: string | null,
) {
  // Calculate dates
  const purchaseDate = new Date();
  const updateExpiryDate = new Date(purchaseDate);
  updateExpiryDate.setFullYear(updateExpiryDate.getFullYear() + 1);

  // Determine currentUpdateVersion
  let currentUpdateVersion: string | null = null;
  let setTypeId = pendingOrder.setTypeId;

  // If no setTypeId (custom amount), use or create fallback
  if (!setTypeId && !pendingOrder.isUpdateOnly) {
    let fallbackSet = await prisma.setType.findFirst({ where: { name: "סכום חופשי" } });
    if (!fallbackSet) {
      fallbackSet = await prisma.setType.create({
        data: { name: "סכום חופשי", price: 0, includesUpdates: false, sortOrder: 100, isActive: false },
      });
    }
    setTypeId = fallbackSet.id;
  }

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

  // Wrap core DB operations in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create customer
    const customer = await tx.customer.create({
      data: {
        fullName: pendingOrder.fullName,
        phone: pendingOrder.phone,
        email: pendingOrder.email,
        organId: pendingOrder.organId,
        setTypeId: setTypeId!,
        amountPaid: Number(pendingOrder.amount),
        purchaseDate,
        updateExpiryDate,
        hasV3: true,
        sampleType: "CPI",
        currentUpdateVersion,
        status: "PENDING_APPROVAL",
        notes: pendingOrder.notes,
        icountClientId: payment.clientId,
        promotionId: promotionId || undefined,
      },
    });

    // Create payment record
    await tx.payment.create({
      data: {
        customerId: customer.id,
        amount: payment.total || Number(pendingOrder.amount),
        description: pendingOrder.isUpdateOnly ? "עדכון תוכנה" : "רכישת סט",
        status: "COMPLETED",
        paymentMethod: "ICOUNT",
        externalPaymentId: payment.paymentId,
        receiptNumber: payment.docnum,
        receiptUrl: payment.docUrl,
        hasReceipt: !!payment.docnum,
        promotionId: promotionId || undefined,
      },
    });

    // Log activity (inline instead of logActivity helper, which uses prisma directly)
    await tx.activityLog.create({
      data: {
        customerId: customer.id,
        action: "CREATE",
        entityType: "CUSTOMER",
        entityId: String(customer.id),
        details: {
          fullName: customer.fullName,
          source: "icount_payment",
          receiptNumber: payment.docnum,
          paymentPageId: payment.cp,
        } as Prisma.InputJsonValue,
      },
    });

    // Mark as completed
    await tx.pendingOrder.update({
      where: { id: pendingOrder.id },
      data: { status: "COMPLETED" },
    });

    return { customer };
  });

  // Upload info files to Google Drive (external operation — outside transaction)
  try {
    const fileName = `${result.customer.id}.n27`;
    const url = await uploadFile(Buffer.from(pendingOrder.infoFileData), fileName, "customers/info");
    const updateData: Record<string, string> = { infoFileUrl: url };

    if (pendingOrder.additionalInfoFileData && pendingOrder.additionalInfoFileData.length > 0) {
      const addFileName = `${result.customer.id}_2.n27`;
      const addUrl = await uploadFile(Buffer.from(pendingOrder.additionalInfoFileData), addFileName, "customers/info");
      updateData.additionalInfoFileUrl = addUrl;
    }

    await prisma.customer.update({
      where: { id: result.customer.id },
      data: updateData,
    });
  } catch (uploadErr) {
    console.error("Error uploading info file:", uploadErr);
  }

  return result.customer;
}

/**
 * Handle document webhooks from iCount
 */
async function handleDocumentWebhook(body: Record<string, unknown>) {
  try {
    const doctype = body.doctype as string | undefined;
    const docnum = body.docnum as string | undefined;
    const doc_link = body.doc_link as string | undefined;
    const clientname = body.clientname as string | undefined;
    const dateissued = body.dateissued as string | undefined;

    console.log("iCount document webhook:", { doctype, docnum, doc_link, clientname, dateissued });

    if (docnum) {
      const existingPayment = await prisma.payment.findFirst({
        where: { receiptNumber: String(docnum) },
      });

      if (existingPayment) {
        if (!existingPayment.receiptUrl && doc_link) {
          await prisma.payment.update({
            where: { id: existingPayment.id },
            data: {
              receiptUrl: String(doc_link),
              hasReceipt: true,
            },
          });

          if (existingPayment.customerId) {
            await logActivity({
              customerId: existingPayment.customerId,
              action: "UPDATE",
              entityType: "PAYMENT",
              entityId: existingPayment.id,
              details: { receiptNumber: docnum, receiptUrl: doc_link, doctype },
            });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("iCount document webhook error:", error);
    return NextResponse.json({ received: true });
  }
}
