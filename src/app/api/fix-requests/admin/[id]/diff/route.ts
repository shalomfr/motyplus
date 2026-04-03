import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { REPOS, RepoKey } from "@/lib/fix-requests";

// GET /api/fix-requests/admin/[id]/diff — diff מ-PR
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

    if (!conversation?.prNumber || !conversation.targetRepo) {
      return NextResponse.json(
        { error: "אין PR לשיחה זו" },
        { status: 404 }
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

    // Get PR files with diff
    const res = await fetch(
      `https://api.github.com/repos/${repoConfig.staging}/pulls/${conversation.prNumber}/files`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "שגיאה בשליפת diff מ-GitHub" },
        { status: 500 }
      );
    }

    const files = await res.json();

    return NextResponse.json({
      prUrl: conversation.prUrl,
      prNumber: conversation.prNumber,
      files: files.map(
        (f: {
          filename: string;
          status: string;
          additions: number;
          deletions: number;
          patch?: string;
        }) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch || "",
        })
      ),
    });
  } catch (error) {
    console.error("Error fetching diff:", error);
    return NextResponse.json(
      { error: "שגיאה בשליפת diff" },
      { status: 500 }
    );
  }
}
