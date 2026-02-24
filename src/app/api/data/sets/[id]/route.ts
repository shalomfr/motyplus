import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { setTypeSchema } from "@/lib/validators";

// PUT /api/data/sets/[id] - עדכון סוג סט
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

    const existing = await prisma.setType.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "סוג הסט לא נמצא" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = setTypeSchema.partial().safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // אם שינו שם, בדיקה שהשם לא קיים
    if (data.name && data.name !== existing.name) {
      const nameExists = await prisma.setType.findUnique({
        where: { name: data.name },
      });
      if (nameExists) {
        return NextResponse.json(
          { error: "סוג סט בשם זה כבר קיים" },
          { status: 409 }
        );
      }
    }

    const setType = await prisma.setType.update({
      where: { id },
      data: {
        ...data,
        price: data.price !== undefined ? data.price : undefined,
      },
    });

    return NextResponse.json(setType);
  } catch (error) {
    console.error("Error updating set type:", error);
    return NextResponse.json(
      { error: "שגיאה בעדכון סוג הסט" },
      { status: 500 }
    );
  }
}

// DELETE /api/data/sets/[id] - מחיקת סוג סט (רק אם אין לקוחות)
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

    const existing = await prisma.setType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { customers: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "סוג הסט לא נמצא" },
        { status: 404 }
      );
    }

    if (existing._count.customers > 0) {
      return NextResponse.json(
        {
          error: `לא ניתן למחוק את סוג הסט. קיימים ${existing._count.customers} לקוחות המשויכים אליו`,
        },
        { status: 400 }
      );
    }

    await prisma.setType.delete({
      where: { id },
    });

    return NextResponse.json({ message: "סוג הסט נמחק בהצלחה" });
  } catch (error) {
    console.error("Error deleting set type:", error);
    return NextResponse.json(
      { error: "שגיאה במחיקת סוג הסט" },
      { status: 500 }
    );
  }
}
