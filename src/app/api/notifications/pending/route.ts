import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const [count, customers] = await Promise.all([
      prisma.customer.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.customer.findMany({
        where: { status: "PENDING_APPROVAL" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          fullName: true,
          createdAt: true,
          organ: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      count,
      customers: customers.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        organName: c.organ.name,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching pending notifications:", error);
    return NextResponse.json({ error: "שגיאה בטעינת התראות" }, { status: 500 });
  }
}
