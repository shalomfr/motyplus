import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { REPOS, RepoKey } from "@/lib/fix-requests";

// POST /api/fix-requests/admin/sync-from-main — סנכרון staging מהריפו הראשי
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const body = await request.json();
    const { repo } = body;

    if (!repo || !REPOS[repo as RepoKey]) {
      return NextResponse.json(
        { error: "נא לציין ריפו תקין" },
        { status: 400 }
      );
    }

    const repoConfig = REPOS[repo as RepoKey];
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "GITHUB_TOKEN not configured" },
        { status: 500 }
      );
    }

    // Use GitHub's merge API to sync: create a PR from main repo to staging
    // First, check if staging has the main repo as upstream
    // Since they're separate repos (not forks), we'll use the dispatch event approach
    // Trigger a workflow dispatch to sync

    // Alternative: Use the GitHub API to trigger a sync workflow
    // For now, we'll create a repository_dispatch event
    const dispatchRes = await fetch(
      `https://api.github.com/repos/${repoConfig.staging}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          event_type: "sync-from-main",
          client_payload: {
            main_repo: repoConfig.main,
          },
        }),
      }
    );

    if (!dispatchRes.ok) {
      const err = await dispatchRes.text();
      return NextResponse.json(
        { error: `שגיאה בהפעלת סנכרון: ${err}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `סנכרון הופעל עבור ${repoConfig.label}`,
      repo: repo,
    });
  } catch (error) {
    console.error("Error syncing from main:", error);
    return NextResponse.json(
      { error: "שגיאה בסנכרון" },
      { status: 500 }
    );
  }
}
