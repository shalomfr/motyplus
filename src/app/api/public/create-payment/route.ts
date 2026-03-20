import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBillingClient } from "@/lib/billing";

// POST /api/public/create-payment — יצירת דף תשלום iCount (מחליף Stripe Checkout)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const fullName = formData.get("fullName") as string;
    const phone = formData.get("phone") as string;
    const email = formData.get("email") as string;
    const organId = formData.get("organId") as string;
    const setTypeId = formData.get("setTypeId") as string | null;
    const updateVersionId = formData.get("updateVersionId") as string | null;
    const isUpdateOnly = formData.get("isUpdateOnly") === "true";
    const notes = formData.get("notes") as string | null;
    const infoFile = formData.get("infoFile") as File | null;

    if (!fullName || !phone || !email || !organId) {
      return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
    }

    // Determine price
    let amount = 0;
    let description = "";

    if (isUpdateOnly && updateVersionId) {
      const ver = await prisma.updateVersion.findUnique({ where: { id: updateVersionId } });
      if (!ver) return NextResponse.json({ error: "גרסת עדכון לא נמצאה" }, { status: 400 });
      amount = Number(ver.price);
      description = `עדכון תוכנה ${ver.version}`;
    } else if (setTypeId) {
      const setType = await prisma.setType.findUnique({ where: { id: setTypeId } });
      if (!setType) return NextResponse.json({ error: "סוג סט לא נמצא" }, { status: 400 });
      amount = Number(setType.price);
      description = `רכישת סט ${setType.name}`;
    } else {
      return NextResponse.json({ error: "יש לבחור סוג סט או עדכון" }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: "מחיר לא תקין" }, { status: 400 });
    }

    // Read info file
    let infoFileData = Buffer.alloc(0);
    let infoFileName = "";
    if (infoFile) {
      const bytes = await infoFile.bytes();
      infoFileData = Buffer.from(bytes);
      infoFileName = infoFile.name;
    }

    // Get billing provider
    const billing = await getBillingClient();

    if (!billing) {
      return NextResponse.json({ error: "לא הוגדר ספק חיוב — פנה למנהל" }, { status: 503 });
    }

    const client = billing.client;

    // Save pending order
    const pendingOrder = await prisma.pendingOrder.create({
      data: {
        stripeSessionId: `billing_${Date.now()}`, // unique ID (field is @unique)
        fullName,
        phone,
        email,
        organId,
        setTypeId,
        updateVersionId,
        isUpdateOnly,
        amount,
        infoFileData,
        infoFileName,
        notes,
      },
    });

    // Create payment page via billing provider
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.AUTH_URL || "";

    // Determine webhook URL based on provider type
    const webhookPath = billing.provider.provider === "YESHINVOICE"
      ? "/api/webhooks/yeshinvoice"
      : "/api/webhooks/icount";

    const paymentPage = await client.createPaymentPage({
      customer: { name: fullName, email, phone },
      items: [{ description, quantity: 1, unitPrice: amount }],
      successUrl: `${baseUrl}/order/success`,
      cancelUrl: `${baseUrl}/order/cancel`,
      webhookUrl: `${baseUrl}${webhookPath}`,
      autoCreateDoc: true,
      docType: "invoice_receipt",
      metadata: { pendingOrderId: pendingOrder.id },
    });

    if (!paymentPage.url) {
      return NextResponse.json({ error: "לא ניתן ליצור דף תשלום" }, { status: 500 });
    }

    return NextResponse.json({ url: paymentPage.url });
  } catch (error) {
    console.error("Error creating payment:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "שגיאה ביצירת דף תשלום — יתכן שהתוכנה לא זמינה כרגע", debug: msg },
      { status: 500 }
    );
  }
}
