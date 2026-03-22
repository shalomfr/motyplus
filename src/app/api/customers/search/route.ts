import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET /api/customers/search?q=שלום — חיפוש בכל הלקוחות (ללא פילטר זכאות)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 })
    }

    const q = request.nextUrl.searchParams.get("q")?.trim()
    if (!q || q.length < 2) {
      return NextResponse.json({ customers: [] })
    }

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { customerId: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        customerId: true,
        status: true,
        organ: { select: { name: true } },
      },
      take: 15,
      orderBy: { fullName: "asc" },
    })

    return NextResponse.json({ customers })
  } catch (error) {
    console.error("Error searching customers:", error)
    return NextResponse.json({ error: "שגיאה בחיפוש" }, { status: 500 })
  }
}
