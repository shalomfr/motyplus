import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET /api/work-orders — רשימת עבודה: לקוחות ממתינים לאישור או שלא נשלחה להם הזמנה
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 })
    }

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { status: "PENDING_APPROVAL" },
          { orderSentAt: null },
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        orderSentAt: true,
        createdAt: true,
        purchaseDate: true,
        amountPaid: true,
        organ: { select: { id: true, name: true } },
        setType: { select: { id: true, name: true } },
        payments: {
          select: { id: true, status: true, amount: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const mapped = customers.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      status: c.status,
      orderSentAt: c.orderSentAt,
      createdAt: c.createdAt,
      purchaseDate: c.purchaseDate,
      amountPaid: Number(c.amountPaid),
      organName: c.organ.name,
      setTypeName: c.setType.name,
      hasPaid: c.payments.some((p) => p.status === "COMPLETED") || Number(c.amountPaid) > 0,
    }))

    return NextResponse.json({
      customers: mapped,
      counts: {
        total: mapped.length,
        pendingApproval: mapped.filter((c) => c.status === "PENDING_APPROVAL").length,
        orderNotSent: mapped.filter((c) => !c.orderSentAt).length,
      },
    })
  } catch (error) {
    console.error("Error fetching work orders:", error)
    return NextResponse.json({ error: "שגיאה בטעינת רשימת עבודה" }, { status: 500 })
  }
}
