import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { publicOrderSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract fields
    const fields = {
      fullName: formData.get("fullName") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      organId: formData.get("organId") as string,
      isUpdateOnly: formData.get("isUpdateOnly") === "true",
      setTypeId: (formData.get("setTypeId") as string) || null,
      updateVersionId: (formData.get("updateVersionId") as string) || null,
      notes: (formData.get("notes") as string) || null,
    };

    // Validate
    const validation = publicOrderSchema.safeParse(fields);
    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }
    const data = validation.data;

    // Get info file
    const file = formData.get("infoFile") as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "יש להעלות קובץ אינפו (.n27)" },
        { status: 400 }
      );
    }

    // Calculate amount
    let amount: number;
    let productName: string;

    if (data.isUpdateOnly && data.updateVersionId) {
      const version = await prisma.updateVersion.findUnique({
        where: { id: data.updateVersionId },
        select: { price: true, version: true },
      });
      if (!version) {
        return NextResponse.json({ error: "גרסת עדכון לא נמצאה" }, { status: 400 });
      }
      amount = Number(version.price);
      productName = `עדכון תוכנה ${version.version}`;
    } else if (data.setTypeId) {
      const setType = await prisma.setType.findUnique({
        where: { id: data.setTypeId },
        select: { price: true, name: true },
      });
      if (!setType) {
        return NextResponse.json({ error: "סוג סט לא נמצא" }, { status: 400 });
      }
      amount = Number(setType.price);
      productName = `סט ${setType.name}`;
    } else {
      return NextResponse.json({ error: "יש לבחור מוצר" }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: "סכום לא תקין" }, { status: 400 });
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Get organ name for description
    const organ = await prisma.organ.findUnique({
      where: { id: data.organId },
      select: { name: true },
    });

    // Create Stripe Checkout Session
    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.AUTH_URL || "https://motyplus-2hvb.onrender.com";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: data.email,
      line_items: [
        {
          price_data: {
            currency: "ils",
            product_data: {
              name: productName,
              description: organ ? `אורגן: ${organ.name}` : undefined,
            },
            unit_amount: Math.round(amount * 100), // Stripe uses agorot
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/order/cancel`,
      metadata: {
        pendingOrderId: "placeholder", // will update after saving
      },
    });

    // Save PendingOrder
    const pendingOrder = await prisma.pendingOrder.create({
      data: {
        stripeSessionId: session.id,
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        organId: data.organId,
        setTypeId: data.setTypeId || null,
        updateVersionId: data.updateVersionId || null,
        isUpdateOnly: data.isUpdateOnly,
        amount,
        infoFileData: fileBuffer,
        infoFileName: file.name,
        notes: data.notes || null,
      },
    });

    // Update Stripe session metadata with actual pendingOrderId
    await stripe.checkout.sessions.update(session.id, {
      metadata: { pendingOrderId: pendingOrder.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout:", error);
    return NextResponse.json(
      { error: "שגיאה ביצירת הזמנה" },
      { status: 500 }
    );
  }
}
