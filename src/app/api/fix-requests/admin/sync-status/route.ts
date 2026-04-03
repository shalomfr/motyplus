import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { REPOS, RepoKey, REPO_KEYS } from "@/lib/fix-requests";

// GET /api/fix-requests/admin/sync-status — סטטוס סנכרון per repo
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "GITHUB_TOKEN not configured" },
        { status: 500 }
      );
    }

    const results = await Promise.all(
      REPO_KEYS.map(async (key: RepoKey) => {
        const repo = REPOS[key];

        // Compare staging vs main
        try {
          const compareRes = await fetch(
            `https://api.github.com/repos/${repo.staging}/compare/main...main`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
              },
            }
          );

          // Get open PRs count
          const prsRes = await fetch(
            `https://api.github.com/repos/${repo.staging}/pulls?state=open&per_page=100`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
              },
            }
          );

          // Get last commit date
          const commitsRes = await fetch(
            `https://api.github.com/repos/${repo.staging}/commits?per_page=1`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
              },
            }
          );

          const prs = prsRes.ok ? await prsRes.json() : [];
          const commits = commitsRes.ok ? await commitsRes.json() : [];
          const compare = compareRes.ok ? await compareRes.json() : null;

          // Count pending fix requests for this repo
          const pendingCount = await prisma.fixConversation.count({
            where: {
              targetRepo: key,
              status: {
                in: ["CONFIRMED", "PROCESSING", "PR_READY"],
              },
            },
          });

          return {
            key,
            label: repo.label,
            stagingRepo: repo.staging,
            mainRepo: repo.main,
            openPRs: prs.length || 0,
            pendingFixes: pendingCount,
            lastCommit: commits[0]?.commit?.committer?.date || null,
            aheadBy: compare?.ahead_by || 0,
            behindBy: compare?.behind_by || 0,
          };
        } catch {
          return {
            key,
            label: repo.label,
            stagingRepo: repo.staging,
            mainRepo: repo.main,
            openPRs: 0,
            pendingFixes: 0,
            lastCommit: null,
            aheadBy: 0,
            behindBy: 0,
            error: "שגיאה בשליפת נתונים",
          };
        }
      })
    );

    return NextResponse.json({ repos: results });
  } catch (error) {
    console.error("Error fetching sync status:", error);
    return NextResponse.json(
      { error: "שגיאה בבדיקת סנכרון" },
      { status: 500 }
    );
  }
}
