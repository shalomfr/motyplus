import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sets = await prisma.setType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, price: true, includesUpdates: true },
    });
    return NextResponse.json(sets);
  } catch {
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
