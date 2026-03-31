import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/public/validate-coupon — אימות קוד קופון (ציבורי, ללא auth)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const couponCode = formData.get("couponCode") as string | null;

    if (!couponCode) {
      return NextResponse.json(
        { valid: false, error: "יש להזין קוד קופון" },
        { status: 400 }
      );
    }

    const promotion = await prisma.promotion.findUnique({
      where: { couponCode: couponCode.trim().toUpperCase() },
    });

    if (!promotion) {
      return NextResponse.json({ valid: false, error: "קוד קופון לא נמצא" });
    }

    if (!promotion.isActive) {
      return NextResponse.json({ valid: false, error: "המבצע אינו פעיל" });
    }

    const now = new Date();
    if (now < promotion.validFrom) {
      return NextResponse.json({ valid: false, error: "המבצע עדיין לא התחיל" });
    }
    if (now > promotion.validUntil) {
      return NextResponse.json({ valid: false, error: "המבצע פג תוקף" });
    }
    if (promotion.maxUses && promotion.currentUses >= promotion.maxUses) {
      return NextResponse.json({ valid: false, error: "המבצע הגיע למכסת השימושים" });
    }

    return NextResponse.json({
      valid: true,
      promotion: {
        name: promotion.name,
        discountPercent: Number(promotion.discountPercent),
        discountAmount: Number(promotion.discountAmount),
      },
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    return NextResponse.json(
      { valid: false, error: "שגיאה באימות הקופון" },
      { status: 500 }
    );
  }
}
