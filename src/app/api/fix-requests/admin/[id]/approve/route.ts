import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { REPOS, RepoKey } from "@/lib/fix-requests";

// POST /api/fix-requests/admin/[id]/approve — merge PR ב-staging + עדכון סטטוס
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
    });

    if (!conversation?.prNumber || !conversation.targetRepo) {
      return NextResponse.json(
        { error: "אין PR לאישור" },
        { status: 400 }
      );
    }

    const repoKey = conversation.targetRepo as RepoKey;
    const repoConfig = REPOS[repoKey];
    if (!repoConfig) {
      return NextResponse.json({ error: "ריפו לא מוכר" }, { status: 400 });
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "GITHUB_TOKEN not configured" },
        { status: 500 }
      );
    }

    // Merge PR in staging repo
    const mergeRes = await fetch(
      `https://api.github.com/repos/${repoConfig.staging}/pulls/${conversation.prNumber}/merge`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          commit_title: `✅ Approved: ${conversation.summary}`,
          merge_method: "squash",
        }),
      }
    );

    if (!mergeRes.ok) {
      const err = await mergeRes.text();
      return NextResponse.json(
        { error: `שגיאה ב-merge: ${err}` },
        { status: 500 }
      );
    }

    // Update status to APPROVED (staging merged, ready for cherry-pick to main)
    await prisma.fixConversation.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    return NextResponse.json({
      status: "APPROVED",
      message: "ה-PR מוזג ב-staging. השינויים יתפרסו ב-preview.",
    });
  } catch (error) {
    console.error("Error approving:", error);
    return NextResponse.json(
      { error: "שגיאה באישור" },
      { status: 500 }
    );
  }
}
