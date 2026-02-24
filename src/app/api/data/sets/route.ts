import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { setTypeSchema } from "@/lib/validators";

// GET /api/data/sets - רשימת סוגי סטים
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const setTypes = await prisma.setType.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { customers: true },
        },
      },
    });

    return NextResponse.json(setTypes);
  } catch (error) {
    console.error("Error fetching set types:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת סוגי הסטים" },
      { status: 500 }
    );
  }
}

// POST /api/data/sets - יצירת סוג סט חדש
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
    const validation = setTypeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // בדיקה שהשם לא קיים
    const existing = await prisma.setType.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "סוג סט בשם זה כבר קיים" },
        { status: 409 }
      );
    }

    // חישוב sortOrder אוטומטי
    const lastSetType = await prisma.setType.findFirst({
      orderBy: { sortOrder: "desc" },
    });
    const nextSortOrder = data.sortOrder ?? (lastSetType?.sortOrder ?? 0) + 1;

    const setType = await prisma.setType.create({
      data: {
        name: data.name,
        folderAlias: data.folderAlias || null,
        price: data.price,
        includesUpdates: data.includesUpdates,
        sortOrder: nextSortOrder,
      },
    });

    return NextResponse.json(setType, { status: 201 });
  } catch (error) {
    console.error("Error creating set type:", error);
    return NextResponse.json(
      { error: "שגיאה ביצירת סוג הסט" },
      { status: 500 }
    );
  }
}
