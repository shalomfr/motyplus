import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { REPOS, RepoKey } from "@/lib/fix-requests";

// POST /api/fix-requests/admin/[id]/reject — דחיית שינוי
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
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || "";

    const conversation = await prisma.fixConversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json({ error: "שיחה לא נמצאה" }, { status: 404 });
    }

    // Close PR if exists
    if (conversation.prNumber && conversation.targetRepo) {
      const repoKey = conversation.targetRepo as RepoKey;
      const repoConfig = REPOS[repoKey];
      const token = process.env.GITHUB_TOKEN;

      if (repoConfig && token) {
        await fetch(
          `https://api.github.com/repos/${repoConfig.staging}/pulls/${conversation.prNumber}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
            },
            body: JSON.stringify({ state: "closed" }),
          }
        );
      }
    }

    await prisma.fixConversation.update({
      where: { id },
      data: {
        status: "REJECTED",
        errorMessage: reason || "נדחה ע\"י המנהל",
      },
    });

    return NextResponse.json({ status: "REJECTED" });
  } catch (error) {
    console.error("Error rejecting:", error);
    return NextResponse.json(
      { error: "שגיאה בדחייה" },
      { status: 500 }
    );
  }
}
