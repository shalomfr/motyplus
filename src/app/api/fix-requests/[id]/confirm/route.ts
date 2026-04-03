import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { REPOS, RepoKey, createGitHubIssue } from "@/lib/fix-requests";

// POST /api/fix-requests/[id]/confirm — אישור + יצירת GitHub Issue
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

    const conversation = await prisma.fixConversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      return NextResponse.json({ error: "שיחה לא נמצאה" }, { status: 404 });
    }

    if (!conversation.targetRepo || !conversation.summary) {
      return NextResponse.json(
        { error: "השיחה עדיין לא מוכנה לאישור — חסר סיכום או ריפו" },
        { status: 400 }
      );
    }

    const repoKey = conversation.targetRepo as RepoKey;
    const repoConfig = REPOS[repoKey];

    if (!repoConfig) {
      return NextResponse.json(
        { error: `ריפו לא מוכר: ${conversation.targetRepo}` },
        { status: 400 }
      );
    }

    // Build issue body with conversation context
    const chatHistory = conversation.messages
      .map((m) => `**${m.role === "user" ? "לקוח" : "AI"}:** ${m.content}`)
      .join("\n\n");

    const issueBody = `## בקשת תיקון אוטומטית

**סיכום:** ${conversation.summary}
**ריפו:** ${repoKey} (${repoConfig.label})
**שיחה:** #${conversation.id}

---

### שיחת בירור מלאה:

${chatHistory}

---

> נוצר אוטומטית ע"י מערכת התיקונים של Motty Beats CRM`;

    // Create GitHub Issue in staging repo
    const issue = await createGitHubIssue(
      repoConfig.staging,
      `🔧 ${conversation.summary}`,
      issueBody
    );

    // Update conversation
    await prisma.fixConversation.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        issueUrl: issue.html_url,
        issueNumber: issue.number,
      },
    });

    return NextResponse.json({
      issueUrl: issue.html_url,
      issueNumber: issue.number,
      status: "CONFIRMED",
    });
  } catch (error) {
    console.error("Error confirming fix request:", error);
    return NextResponse.json(
      { error: "שגיאה באישור הבקשה" },
      { status: 500 }
    );
  }
}
