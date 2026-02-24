import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { promotionSchema } from "@/lib/validators";

// GET /api/promotions - רשימת מבצעים
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const promotions = await prisma.promotion.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });

    return NextResponse.json(promotions);
  } catch (error) {
    console.error("Error fetching promotions:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת המבצעים" },
      { status: 500 }
    );
  }
}

// POST /api/promotions - יצירת מבצע חדש
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
    const validation = promotionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // בדיקה שקוד הקופון ייחודי
    const existingCoupon = await prisma.promotion.findUnique({
      where: { couponCode: data.couponCode.toUpperCase() },
    });

    if (existingCoupon) {
      return NextResponse.json(
        { error: "קוד קופון זה כבר קיים במערכת" },
        { status: 409 }
      );
    }

    const promotion = await prisma.promotion.create({
      data: {
        name: data.name,
        discountPercent: data.discountPercent,
        couponCode: data.couponCode.toUpperCase(),
        validFrom: new Date(data.validFrom),
        validUntil: new Date(data.validUntil),
        maxUses: data.maxUses,
      },
    });

    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    console.error("Error creating promotion:", error);
    return NextResponse.json(
      { error: "שגיאה ביצירת המבצע" },
      { status: 500 }
    );
  }
}
