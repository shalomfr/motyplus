import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBillingClient } from "@/lib/billing";

// POST /api/public/create-payment — יצירת דף תשלום
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
    const couponCode = formData.get("couponCode") as string | null;

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

    // בדיקת קוד קופון
    let promotionId: string | null = null;
    if (couponCode) {
      const promotion = await prisma.promotion.findUnique({
        where: { couponCode: couponCode.trim() },
      });
      if (!promotion || !promotion.isActive) {
        return NextResponse.json({ error: "קוד קופון לא תקין" }, { status: 400 });
      }
      const now = new Date();
      if (now < new Date(promotion.validFrom) || now > new Date(promotion.validUntil)) {
        return NextResponse.json({ error: "קוד הקופון פג תוקף" }, { status: 400 });
      }
      if (promotion.maxUses && promotion.currentUses >= promotion.maxUses) {
        return NextResponse.json({ error: "קוד הקופון מוצה" }, { status: 400 });
      }
      amount = Math.round(amount * (1 - promotion.discountPercent / 100));
      description += ` (קופון ${couponCode} — ${promotion.discountPercent}% הנחה)`;
      promotionId = promotion.id;
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

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.AUTH_URL || "";
    const webhookPathMap: Record<string, string> = {
      CARDCOM: "/api/webhooks/cardcom",
      YESHINVOICE: "/api/webhooks/yeshinvoice",
      ICOUNT: "/api/webhooks/icount",
    };
    const webhookPath = webhookPathMap[billing.provider.provider] || "/api/webhooks/icount";

    // Create pending order FIRST so we can pass its ID in metadata
    const pendingOrder = await prisma.pendingOrder.create({
      data: {
        stripeSessionId: `billing_${Date.now()}`,
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

    let webhookUrl = `${baseUrl}${webhookPath}`;
    const webhookSecret = billing.provider.provider === "CARDCOM"
      ? process.env.CARDCOM_WEBHOOK_SECRET
      : billing.provider.provider === "YESHINVOICE"
        ? process.env.YESHINVOICE_WEBHOOK_SECRET
        : null;
    if (webhookSecret) {
      webhookUrl += `?secret=${webhookSecret}`;
    }

    // Create payment page with pendingOrderId in metadata
    let paymentPage;
    try {
      paymentPage = await billing.client.createPaymentPage({
        customer: { name: fullName, email, phone },
        items: [{ description, quantity: 1, unitPrice: amount }],
        successUrl: `${baseUrl}/order/success`,
        cancelUrl: `${baseUrl}/order/cancel`,
        webhookUrl,
        autoCreateDoc: true,
        docType: "invoice_receipt",
        metadata: { pendingOrderId: pendingOrder.id, promotionId: promotionId || "" },
      });
    } catch (err) {
      // Cleanup pending order if payment page creation fails
      await prisma.pendingOrder.delete({ where: { id: pendingOrder.id } });
      throw err;
    }

    if (!paymentPage.url) {
      await prisma.pendingOrder.delete({ where: { id: pendingOrder.id } });
      return NextResponse.json({ error: "לא ניתן ליצור דף תשלום" }, { status: 500 });
    }

    // עדכון שימוש בקופון
    if (promotionId) {
      await prisma.promotion.update({
        where: { id: promotionId },
        data: { currentUses: { increment: 1 } },
      });
    }

    return NextResponse.json({ url: paymentPage.url });
  } catch (error) {
    console.error("Error creating payment:", error);
    return NextResponse.json(
      { error: "שגיאה ביצירת דף תשלום — יתכן שהתוכנה לא זמינה כרגע" },
      { status: 500 }
    );
  }
}
