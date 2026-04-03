import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { REPOS, RepoKey, REPO_KEYS, createGitHubIssue } from "@/lib/fix-requests";

// POST /api/fix-requests/webhook/render — Render deploy status webhook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    // Render sends: { type: "deploy", data: { serviceId, deployId, status, ... } }
    if (type !== "deploy" || !data) {
      return NextResponse.json({ ok: true });
    }

    const { status, serviceId } = data;

    if (status === "build_failed" || status === "update_failed") {
      await handleBuildFailure(serviceId, data);
    } else if (status === "live") {
      await handleDeployLive(serviceId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Render webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleBuildFailure(
  serviceId: string,
  deployData: { deployId?: string; commitMessage?: string }
) {
  // Find which repo this service belongs to
  // We need to match serviceId to a repo — for now check recent conversations
  const recentConversation = await prisma.fixConversation.findFirst({
    where: {
      status: { in: ["CONFIRMED", "PROCESSING", "PR_READY", "PREVIEW_LIVE"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!recentConversation || !recentConversation.targetRepo) return;

  const retryCount = recentConversation.retryCount || 0;

  if (retryCount >= 3) {
    // Max retries reached — mark as failed
    await prisma.fixConversation.update({
      where: { id: recentConversation.id },
      data: {
        status: "FAILED",
        errorMessage:
          "לא הצלחנו לתקן אוטומטית אחרי 3 ניסיונות. שלום יטפל בזה בהקדם.",
      },
    });
    return;
  }

  const repoKey = recentConversation.targetRepo as RepoKey;
  const repoConfig = REPOS[repoKey];
  if (!repoConfig) return;

  // Fetch build logs from Render
  let buildLogs = "Build logs unavailable";
  try {
    const renderKey = process.env.RENDER_API_KEY;
    if (renderKey && deployData.deployId) {
      const logsRes = await fetch(
        `https://api.render.com/v1/services/${serviceId}/deploys/${deployData.deployId}/logs`,
        { headers: { Authorization: `Bearer ${renderKey}` } }
      );
      if (logsRes.ok) {
        const logs = await logsRes.json();
        buildLogs = logs
          .slice(-50)
          .map((l: { message: string }) => l.message)
          .join("\n");
      }
    }
  } catch {
    // ignore log fetch errors
  }

  // Create GitHub Issue to auto-fix the build
  await createGitHubIssue(
    repoConfig.staging,
    `🔧 Auto-fix build failure (attempt ${retryCount + 1}/3)`,
    `## Build Failed

The deploy failed after a recent fix. Please analyze the build logs and fix the issue.

### Build Logs (last 50 lines):
\`\`\`
${buildLogs}
\`\`\`

### Context
- Related conversation: ${recentConversation.id}
- Original fix: ${recentConversation.summary}
- Retry attempt: ${retryCount + 1}/3

### Instructions
1. Read the build logs carefully
2. Identify the error
3. Fix the code
4. Make sure the fix compiles correctly`
  );

  // Update retry count
  await prisma.fixConversation.update({
    where: { id: recentConversation.id },
    data: {
      retryCount: retryCount + 1,
      errorMessage: `תקלת build — ניסיון תיקון אוטומטי ${retryCount + 1}/3`,
    },
  });
}

async function handleDeployLive(serviceId: string) {
  // Find conversations waiting for deploy
  const conversations = await prisma.fixConversation.findMany({
    where: {
      status: { in: ["APPROVED", "PR_READY", "PREVIEW_LIVE"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  for (const conv of conversations) {
    await prisma.fixConversation.update({
      where: { id: conv.id },
      data: {
        status: "PREVIEW_LIVE",
        previewUrl: "https://motyplus-staging.onrender.com",
      },
    });
  }
}
