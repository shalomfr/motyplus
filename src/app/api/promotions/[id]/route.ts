import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { promotionSchema } from "@/lib/validators";

// GET /api/promotions/[id] - קבלת מבצע
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const promotion = await prisma.promotion.findUnique({
      where: { id },
      include: {
        payments: {
          include: {
            customer: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { payments: true },
        },
      },
    });

    if (!promotion) {
      return NextResponse.json(
        { error: "המבצע לא נמצא" },
        { status: 404 }
      );
    }

    return NextResponse.json(promotion);
  } catch (error) {
    console.error("Error fetching promotion:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת המבצע" },
      { status: 500 }
    );
  }
}

// PUT /api/promotions/[id] - עדכון מבצע
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const existing = await prisma.promotion.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "המבצע לא נמצא" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = promotionSchema.partial().safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // אם שינו קוד קופון, בדיקה שהקוד ייחודי
    if (data.couponCode && data.couponCode.toUpperCase() !== existing.couponCode) {
      const couponExists = await prisma.promotion.findUnique({
        where: { couponCode: data.couponCode.toUpperCase() },
      });
      if (couponExists) {
        return NextResponse.json(
          { error: "קוד קופון זה כבר קיים במערכת" },
          { status: 409 }
        );
      }
    }

    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        ...data,
        couponCode: data.couponCode
          ? data.couponCode.toUpperCase()
          : undefined,
        validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      },
    });

    return NextResponse.json(promotion);
  } catch (error) {
    console.error("Error updating promotion:", error);
    return NextResponse.json(
      { error: "שגיאה בעדכון המבצע" },
      { status: 500 }
    );
  }
}

// DELETE /api/promotions/[id] - מחיקת מבצע
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const existing = await prisma.promotion.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "המבצע לא נמצא" },
        { status: 404 }
      );
    }

    await prisma.promotion.delete({
      where: { id },
    });

    return NextResponse.json({ message: "המבצע נמחק בהצלחה" });
  } catch (error) {
    console.error("Error deleting promotion:", error);
    return NextResponse.json(
      { error: "שגיאה במחיקת המבצע" },
      { status: 500 }
    );
  }
}
