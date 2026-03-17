import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/customers/missing-info — רשימת לקוחות פעילים שאין להם קובץ אינפו
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const customers = await prisma.customer.findMany({
      where: {
        infoFileUrl: null,
        status: { in: ["ACTIVE", "EXCEPTION"] },
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        organ: { select: { name: true } },
      },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({
      customers: customers.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        organName: c.organ.name,
      })),
      count: customers.length,
    });
  } catch (error) {
    console.error("Error fetching missing info:", error);
    return NextResponse.json({ error: "שגיאה בטעינת הנתונים" }, { status: 500 });
  }
}
