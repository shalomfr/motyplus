import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/fix-requests — כל השיחות
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const conversations = await prisma.fixConversation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Error fetching fix conversations:", error);
    return NextResponse.json(
      { error: "שגיאה בטעינת השיחות" },
      { status: 500 }
    );
  }
}

// POST /api/fix-requests — יצירת שיחה חדשה
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string" || message.trim().length < 2) {
      return NextResponse.json(
        { error: "נא לכתוב הודעה" },
        { status: 400 }
      );
    }

    const conversation = await prisma.fixConversation.create({
      data: {
        status: "CLARIFYING",
        messages: {
          create: {
            role: "user",
            content: message.trim(),
          },
        },
      },
      include: { messages: true },
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("Error creating fix conversation:", error);
    return NextResponse.json(
      { error: "שגיאה ביצירת שיחה" },
      { status: 500 }
    );
  }
}
