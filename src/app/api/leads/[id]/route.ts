import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { leadSchema } from "@/lib/validators";
import { logActivity } from "@/lib/activity-logger";

// GET /api/leads/[id] - קבלת ליד עם הערות ומידע סוכן
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

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        organ: true,
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        notes: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        convertedCustomer: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "הליד לא נמצא" },
        { status: 404 }
      );
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Error fetching lead:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת הליד" },
      { status: 500 }
    );
  }
}

// PUT /api/leads/[id] - עדכון ליד
export async function PUT(
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

    const existing = await prisma.lead.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "הליד לא נמצא" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = leadSchema.partial().safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...data,
      },
      include: {
        organ: true,
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "LEAD",
      entityId: lead.id,
      details: { updatedFields: Object.keys(data), stage: lead.stage },
    });

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Error updating lead:", error);
    return NextResponse.json(
      { error: "שגיאה בעדכון הליד" },
      { status: 500 }
    );
  }
}

// DELETE /api/leads/[id] - מחיקת ליד
export async function DELETE(
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

    const existing = await prisma.lead.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "הליד לא נמצא" },
        { status: 404 }
      );
    }

    await prisma.lead.delete({
      where: { id },
    });

    await logActivity({
      userId: session.user.id,
      action: "DELETE",
      entityType: "LEAD",
      entityId: id,
      details: { fullName: existing.fullName },
    });

    return NextResponse.json({ message: "הליד נמחק בהצלחה" });
  } catch (error) {
    console.error("Error deleting lead:", error);
    return NextResponse.json(
      { error: "שגיאה במחיקת הליד" },
      { status: 500 }
    );
  }
}
