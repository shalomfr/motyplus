import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { REPOS, RepoKey, getGitHubPRsForIssue } from "@/lib/fix-requests";

// GET /api/fix-requests/[id]/status — סטטוס נוכחי עם polling
export async function GET(
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

    if (!conversation) {
      return NextResponse.json({ error: "שיחה לא נמצאה" }, { status: 404 });
    }

    // If status is CONFIRMED or PROCESSING, check GitHub for PR
    if (
      (conversation.status === "CONFIRMED" ||
        conversation.status === "PROCESSING") &&
      conversation.targetRepo &&
      conversation.issueNumber
    ) {
      const repoKey = conversation.targetRepo as RepoKey;
      const repoConfig = REPOS[repoKey];

      if (repoConfig) {
        const prs = await getGitHubPRsForIssue(
          repoConfig.staging,
          conversation.issueNumber
        );

        if (prs.length > 0) {
          const pr = prs[0];
          const newStatus = pr.merged_at
            ? "PREVIEW_LIVE"
            : pr.state === "open"
              ? "PR_READY"
              : conversation.status;

          if (newStatus !== conversation.status) {
            await prisma.fixConversation.update({
              where: { id },
              data: {
                status: newStatus,
                prUrl: pr.html_url,
                prNumber: pr.number,
              },
            });

            return NextResponse.json({
              ...conversation,
              status: newStatus,
              prUrl: pr.html_url,
              prNumber: pr.number,
            });
          }
        }
      }
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Error fetching status:", error);
    return NextResponse.json(
      { error: "שגיאה בבדיקת סטטוס" },
      { status: 500 }
    );
  }
}
