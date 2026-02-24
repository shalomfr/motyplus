import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { organSchema } from "@/lib/validators";

// PATCH /api/data/organs/[id] - עדכון אורגן
export async function PATCH(
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

    const existing = await prisma.organ.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "האורגן לא נמצא" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = organSchema.partial().safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // אם שינו שם, בדיקה שהשם לא קיים
    if (data.name && data.name !== existing.name) {
      const nameExists = await prisma.organ.findUnique({
        where: { name: data.name },
      });
      if (nameExists) {
        return NextResponse.json(
          { error: "אורגן בשם זה כבר קיים" },
          { status: 409 }
        );
      }
    }

    const organ = await prisma.organ.update({
      where: { id },
      data,
    });

    return NextResponse.json(organ);
  } catch (error) {
    console.error("Error updating organ:", error);
    return NextResponse.json(
      { error: "שגיאה בעדכון האורגן" },
      { status: 500 }
    );
  }
}

// DELETE /api/data/organs/[id] - מחיקת אורגן (רק אם אין לקוחות)
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

    const existing = await prisma.organ.findUnique({
      where: { id },
      include: {
        _count: {
          select: { customers: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "האורגן לא נמצא" },
        { status: 404 }
      );
    }

    if (existing._count.customers > 0) {
      return NextResponse.json(
        {
          error: `לא ניתן למחוק את האורגן. קיימים ${existing._count.customers} לקוחות המשויכים אליו`,
        },
        { status: 400 }
      );
    }

    await prisma.organ.delete({
      where: { id },
    });

    return NextResponse.json({ message: "האורגן נמחק בהצלחה" });
  } catch (error) {
    console.error("Error deleting organ:", error);
    return NextResponse.json(
      { error: "שגיאה במחיקת האורגן" },
      { status: 500 }
    );
  }
}
