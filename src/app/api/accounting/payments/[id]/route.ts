import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity-logger";

// GET /api/accounting/payments/[id] — קבלת תשלום בודד
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "תשלום לא נמצא" },
        { status: 404 }
      );
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Error fetching payment:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת תשלום" },
      { status: 500 }
    );
  }
}

// PATCH /api/accounting/payments/[id] — עדכון סטטוס תשלום (החזר, כישלון)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status, reason } = body;

    if (!status) {
      return NextResponse.json(
        { error: "חסר שדה סטטוס" },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "תשלום לא נמצא" },
        { status: 404 }
      );
    }

    // מעברי סטטוס מותרים
    const validTransitions: Record<string, string[]> = {
      PENDING: ["COMPLETED", "FAILED"],
      COMPLETED: ["REFUNDED"],
      FAILED: [],
      REFUNDED: [],
    };

    const allowed = validTransitions[payment.status] || [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `לא ניתן לשנות סטטוס מ-${payment.status} ל-${status}` },
        { status: 400 }
      );
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: { status },
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
      },
    });

    await logActivity({
      userId: session.user.id,
      customerId: payment.customerId,
      action: "UPDATE",
      entityType: "PAYMENT",
      entityId: id,
      details: {
        previousStatus: payment.status,
        newStatus: status,
        reason: reason || undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating payment status:", error);
    return NextResponse.json(
      { error: "שגיאה בעדכון סטטוס תשלום" },
      { status: 500 }
    );
  }
}
