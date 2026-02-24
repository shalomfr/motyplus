import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const noteSchema = z.object({
  content: z.string().min(1, "יש להזין תוכן הערה"),
});

// GET /api/leads/[id]/notes - קבלת הערות של ליד
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

    // בדיקה שהליד קיים
    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "הליד לא נמצא" },
        { status: 404 }
      );
    }

    const notes = await prisma.leadNote.findMany({
      where: { leadId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error("Error fetching lead notes:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת ההערות" },
      { status: 500 }
    );
  }
}

// POST /api/leads/[id]/notes - הוספת הערה לליד
export async function POST(
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

    // בדיקה שהליד קיים
    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "הליד לא נמצא" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = noteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const note = await prisma.leadNote.create({
      data: {
        leadId: id,
        userId: session.user.id,
        content: validation.data.content,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Error creating lead note:", error);
    return NextResponse.json(
      { error: "שגיאה בהוספת ההערה" },
      { status: 500 }
    );
  }
}
