import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { leadSchema } from "@/lib/validators";
import { logActivity } from "@/lib/activity-logger";
import { Prisma } from "@prisma/client";

// GET /api/leads - רשימת לידים עם סינון
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get("stage");
    const assignedAgentId = searchParams.get("assignedAgentId");
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");

    const skip = (page - 1) * limit;

    const where: Prisma.LeadWhereInput = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (stage) {
      where.stage = stage as Prisma.EnumLeadStageFilter;
    }

    if (assignedAgentId) {
      where.assignedAgentId = assignedAgentId;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          organ: true,
          assignedAgent: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: { notes: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת הלידים" },
      { status: 500 }
    );
  }
}

// POST /api/leads - יצירת ליד חדש
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = leadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    const lead = await prisma.lead.create({
      data: {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        organId: data.organId,
        organInterest: data.organInterest,
        source: data.source,
        stage: data.stage as "NEW" | "CONTACTED" | "PROPOSAL" | "CLOSED_WON" | "CLOSED_LOST" | undefined,
        assignedAgentId: data.assignedAgentId,
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
      action: "CREATE",
      entityType: "LEAD",
      entityId: lead.id,
      details: { fullName: lead.fullName, source: lead.source },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("Error creating lead:", error);
    return NextResponse.json(
      { error: "שגיאה ביצירת הליד" },
      { status: 500 }
    );
  }
}
