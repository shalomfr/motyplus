import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { callClaudeChat, extractSummary } from "@/lib/fix-requests";

// POST /api/fix-requests/[id]/chat — שליחת הודעה + תשובת AI
export async function POST(
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
    const { message, image } = body;

    if ((!message || typeof message !== "string" || message.trim().length < 1) && !image) {
      return NextResponse.json(
        { error: "נא לכתוב הודעה" },
        { status: 400 }
      );
    }

    // Verify conversation exists and is in CLARIFYING status
    const conversation = await prisma.fixConversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      return NextResponse.json({ error: "שיחה לא נמצאה" }, { status: 404 });
    }

    if (conversation.status !== "CLARIFYING") {
      return NextResponse.json(
        { error: "השיחה כבר לא בשלב בירור" },
        { status: 400 }
      );
    }

    // Save user message (include screenshot marker if image present)
    const userContent = image
      ? `[screenshot:${image}]\n${(message || "").trim()}`
      : (message || "").trim();

    await prisma.chatMessage.create({
      data: {
        conversationId: id,
        role: "user",
        content: userContent,
      },
    });

    // Build message history for Claude — skip _init_ placeholder messages
    const allMessages = conversation.messages
      .filter((m) => m.content !== "_init_")
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    // Add current message — with image support for Claude Vision
    if (image) {
      // Extract base64 data from data URL
      const base64Match = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (base64Match) {
        allMessages.push({
          role: "user",
          content: JSON.stringify([
            {
              type: "image",
              source: {
                type: "base64",
                media_type: base64Match[1],
                data: base64Match[2],
              },
            },
            { type: "text", text: (message || "").trim() || "צילום מסך — מה צריך לתקן כאן?" },
          ]),
        });
      }
    } else {
      allMessages.push({ role: "user", content: (message || "").trim() });
    }

    // Call Claude API
    const aiResponse = await callClaudeChat(allMessages, !!image);

    // Save AI response
    await prisma.chatMessage.create({
      data: {
        conversationId: id,
        role: "assistant",
        content: aiResponse,
      },
    });

    // Check if AI provided a summary (ready to confirm)
    const summaryResult = extractSummary(aiResponse);

    if (summaryResult.ready && summaryResult.repo) {
      await prisma.fixConversation.update({
        where: { id },
        data: {
          targetRepo: summaryResult.repo,
          summary: summaryResult.summary,
        },
      });
    }

    return NextResponse.json({
      message: aiResponse,
      readyToConfirm: summaryResult.ready,
      repo: summaryResult.repo,
      summary: summaryResult.summary,
    });
  } catch (error) {
    console.error("Error in chat:", error);
    return NextResponse.json(
      { error: "שגיאה בשליחת ההודעה" },
      { status: 500 }
    );
  }
}
