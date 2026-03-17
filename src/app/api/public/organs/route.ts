import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const organs = await prisma.organ.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, supportsUpdates: true },
    });
    return NextResponse.json(organs);
  } catch {
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
