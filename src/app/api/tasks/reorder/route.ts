import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// PATCH /api/tasks/reorder - עדכון סדר וסטטוס (drag & drop)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const body = await request.json();
    const { taskId, newStatus, newOrder } = body;

    if (!taskId || !newStatus || newOrder === undefined) {
      return NextResponse.json({ error: "חסרים פרמטרים" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      order: newOrder,
    };

    if (newStatus === "DONE") {
      updateData.completedAt = new Date();
    } else {
      updateData.completedAt = null;
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error reordering task:", error);
    return NextResponse.json({ error: "שגיאה בעדכון סדר" }, { status: 500 });
  }
}
