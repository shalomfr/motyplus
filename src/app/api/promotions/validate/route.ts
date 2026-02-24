import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/promotions/validate - אימות קוד קופון
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { couponCode } = body as { couponCode: string };

    if (!couponCode) {
      return NextResponse.json(
        { error: "יש להזין קוד קופון" },
        { status: 400 }
      );
    }

    const promotion = await prisma.promotion.findUnique({
      where: { couponCode: couponCode.toUpperCase() },
    });

    if (!promotion) {
      return NextResponse.json(
        { valid: false, error: "קוד קופון לא נמצא" },
        { status: 404 }
      );
    }

    // בדיקת פעילות
    if (!promotion.isActive) {
      return NextResponse.json({
        valid: false,
        error: "המבצע אינו פעיל",
      });
    }

    // בדיקת תוקף תאריכים
    const now = new Date();
    if (now < promotion.validFrom) {
      return NextResponse.json({
        valid: false,
        error: "המבצע עדיין לא התחיל",
      });
    }

    if (now > promotion.validUntil) {
      return NextResponse.json({
        valid: false,
        error: "המבצע פג תוקף",
      });
    }

    // בדיקת מספר שימושים מקסימלי
    if (promotion.maxUses && promotion.currentUses >= promotion.maxUses) {
      return NextResponse.json({
        valid: false,
        error: "המבצע הגיע למכסת השימושים המרבית",
      });
    }

    return NextResponse.json({
      valid: true,
      promotion: {
        id: promotion.id,
        name: promotion.name,
        discountPercent: promotion.discountPercent,
        couponCode: promotion.couponCode,
        validUntil: promotion.validUntil,
        remainingUses: promotion.maxUses
          ? promotion.maxUses - promotion.currentUses
          : null,
      },
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    return NextResponse.json(
      { error: "שגיאה באימות הקופון" },
      { status: 500 }
    );
  }
}
