import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { organSchema } from "@/lib/validators";

// GET /api/data/organs - רשימת אורגנים
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const organs = await prisma.organ.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { customers: true },
        },
      },
    });

    return NextResponse.json(organs);
  } catch (error) {
    console.error("Error fetching organs:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת האורגנים" },
      { status: 500 }
    );
  }
}

// POST /api/data/organs - יצירת אורגן חדש
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
    const validation = organSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // בדיקה שהשם לא קיים
    const existing = await prisma.organ.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "אורגן בשם זה כבר קיים" },
        { status: 409 }
      );
    }

    // חישוב sortOrder אוטומטי
    const lastOrgan = await prisma.organ.findFirst({
      orderBy: { sortOrder: "desc" },
    });
    const nextSortOrder = data.sortOrder ?? (lastOrgan?.sortOrder ?? 0) + 1;

    const organ = await prisma.organ.create({
      data: {
        name: data.name,
        folderAlias: data.folderAlias || null,
        organInfoFileUrl: data.organInfoFileUrl || null,
        supportsUpdates: data.supportsUpdates,
        sortOrder: nextSortOrder,
      },
    });

    return NextResponse.json(organ, { status: 201 });
  } catch (error) {
    console.error("Error creating organ:", error);
    return NextResponse.json(
      { error: "שגיאה ביצירת האורגן" },
      { status: 500 }
    );
  }
}
