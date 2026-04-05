import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST /api/work-orders/sample-prep — סימון/ביטול סימון הכנת דגימות
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 })
    }

    const { customerId, updateVersionId, done } = await request.json()

    if (!customerId || !updateVersionId || typeof done !== "boolean") {
      return NextResponse.json(
        { error: "חסרים שדות: customerId, updateVersionId, done" },
        { status: 400 }
      )
    }

    const result = await prisma.samplePrepStatus.upsert({
      where: {
        customerId_updateVersionId: { customerId, updateVersionId },
      },
      create: {
        customerId,
        updateVersionId,
        markedDoneAt: done ? new Date() : null,
        markedDoneById: done ? session.user.id : null,
      },
      update: {
        markedDoneAt: done ? new Date() : null,
        markedDoneById: done ? session.user.id : null,
      },
    })

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("Error updating sample prep status:", error)
    return NextResponse.json(
      { error: "שגיאה בעדכון סטטוס דגימות" },
      { status: 500 }
    )
  }
}
