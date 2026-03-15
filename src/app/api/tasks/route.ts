import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";

// GET /api/tasks - רשימת משימות עם סינון
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const search = searchParams.get("search") || "";

    const where: Prisma.TaskWhereInput = {};

    if (status) {
      where.status = status as Prisma.EnumTaskStatusFilter["equals"];
    }
    if (category) {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    // קטגוריות ייחודיות
    const categories = await prisma.task.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });

    // ספירות לפי סטטוס
    const counts = await prisma.task.groupBy({
      by: ["status"],
      _count: true,
    });

    const countMap: Record<string, number> = {};
    counts.forEach((c) => {
      countMap[c.status] = c._count;
    });

    return NextResponse.json({
      tasks,
      categories: categories.map((c) => c.category),
      counts: {
        IDEA: countMap.IDEA || 0,
        PLANNING: countMap.PLANNING || 0,
        IN_PROGRESS: countMap.IN_PROGRESS || 0,
        DONE: countMap.DONE || 0,
        total: tasks.length,
      },
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "שגיאה בטעינת משימות" }, { status: 500 });
  }
}

// POST /api/tasks - יצירת משימה חדשה
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, status, priority, category } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "שם המשימה הוא שדה חובה" }, { status: 400 });
    }

    // מצא את ה-order הכי גבוה בסטטוס הנתון
    const maxOrder = await prisma.task.aggregate({
      where: { status: status || "IDEA" },
      _max: { order: true },
    });

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        status: status || "IDEA",
        priority: priority || "MEDIUM",
        category: category || "כללי",
        order: (maxOrder._max.order || 0) + 1,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "שגיאה ביצירת משימה" }, { status: 500 });
  }
}
