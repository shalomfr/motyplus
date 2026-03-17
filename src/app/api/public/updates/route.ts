import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const versions = await prisma.updateVersion.findMany({
      where: { status: { not: "DRAFT" } },
      orderBy: { sortOrder: "desc" },
      select: { id: true, version: true, price: true, description: true },
    });
    return NextResponse.json(versions);
  } catch {
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
