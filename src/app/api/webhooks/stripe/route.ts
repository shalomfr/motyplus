import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { uploadFile } from "@/lib/file-storage";
import { logActivity } from "@/lib/activity-logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not set");
      return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const pendingOrderId = session.metadata?.pendingOrderId;

      if (!pendingOrderId) {
        console.error("No pendingOrderId in session metadata");
        return NextResponse.json({ received: true });
      }

      // Fetch pending order (idempotency check)
      const order = await prisma.pendingOrder.findUnique({
        where: { id: pendingOrderId },
      });

      if (!order || order.status !== "PENDING") {
        // Already processed or not found
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
        // For update-only orders, find or create "עדכון בלבד" set type
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
              isActive: false, // hidden from public
            },
          });
        }
        setTypeId = updateOnlySet.id;

        // Set the purchased version
        if (order.updateVersionId) {
          const ver = await prisma.updateVersion.findUnique({
            where: { id: order.updateVersionId },
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
        const url = await uploadFile(
          Buffer.from(order.infoFileData),
          fileName,
          "customers/info"
        );
        await prisma.customer.update({
          where: { id: customer.id },
          data: { infoFileUrl: url },
        });
      } catch (uploadErr) {
        console.error("Error uploading info file:", uploadErr);
        // Customer created but file upload failed — can retry manually
      }

      // Create payment record
      await prisma.payment.create({
        data: {
          customerId: customer.id,
          amount: order.amount,
          description: order.isUpdateOnly ? "עדכון תוכנה" : "רכישת סט",
          status: "COMPLETED",
          paymentMethod: "STRIPE",
          externalPaymentId: typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || null,
        },
      });

      // Log activity
      await logActivity({
        customerId: customer.id,
        action: "CREATE",
        entityType: "CUSTOMER",
        entityId: String(customer.id),
        details: { fullName: customer.fullName, source: "public_order", stripeSession: session.id },
      });

      // Mark as completed
      await prisma.pendingOrder.update({
        where: { id: pendingOrderId },
        data: { status: "COMPLETED" },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 400 }
    );
  }
}
