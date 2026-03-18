import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// DELETE /api/integrations/billing/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { id } = await params;
    await prisma.billingProvider.delete({ where: { id } });
    return NextResponse.json({ message: "ספק נמחק" });
  } catch (error) {
    console.error("Error deleting billing provider:", error);
    return NextResponse.json({ error: "שגיאה במחיקת ספק" }, { status: 500 });
  }
}

// PATCH /api/integrations/billing/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { isActive, isPrimary, settings } = body;

    const updated = await prisma.billingProvider.update({
      where: { id },
      data: {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(isPrimary !== undefined ? { isPrimary } : {}),
        ...(settings !== undefined ? { settings } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating billing provider:", error);
    return NextResponse.json({ error: "שגיאה בעדכון ספק" }, { status: 500 });
  }
}
