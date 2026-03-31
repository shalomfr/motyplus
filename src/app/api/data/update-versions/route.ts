import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/data/update-versions - רשימת גרסאות עדכון
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה" },
        { status: 401 }
      );
    }

    const versions = await prisma.updateVersion.findMany({
      where: { status: { not: "DRAFT" } },
      orderBy: { sortOrder: "desc" },
      select: { id: true, version: true },
    });

    return NextResponse.json(versions);
  } catch (error) {
    console.error("Error fetching update versions:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת גרסאות" },
      { status: 500 }
    );
  }
}
