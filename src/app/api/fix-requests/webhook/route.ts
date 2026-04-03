import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// POST /api/fix-requests/webhook — GitHub webhook receiver
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.FIX_WEBHOOK_SECRET;
    const rawBody = await request.text();

    // Verify signature if secret is configured
    if (secret) {
      const signature = request.headers.get("x-hub-signature-256");
      if (!verifyWebhookSignature(rawBody, signature, secret)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    }

    const event = request.headers.get("x-github-event");
    const payload = JSON.parse(rawBody);

    if (event === "pull_request") {
      await handlePullRequest(payload);
    } else if (event === "issues") {
      await handleIssueEvent(payload);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handlePullRequest(payload: {
  action: string;
  pull_request: {
    html_url: string;
    number: number;
    body?: string;
    merged: boolean;
    state: string;
  };
}) {
  const pr = payload.pull_request;
  const prBody = pr.body || "";

  // Find the conversation linked to this PR's issue
  // PR body should reference the issue number
  const issueMatch = prBody.match(/#(\d+)/);
  if (!issueMatch) return;

  const issueNumber = parseInt(issueMatch[1]);

  // Find conversation by issue number
  const conversation = await prisma.fixConversation.findFirst({
    where: { issueNumber },
  });

  if (!conversation) return;

  if (payload.action === "opened" || payload.action === "synchronize") {
    await prisma.fixConversation.update({
      where: { id: conversation.id },
      data: {
        status: "PR_READY",
        prUrl: pr.html_url,
        prNumber: pr.number,
      },
    });
  } else if (payload.action === "closed" && pr.merged) {
    await prisma.fixConversation.update({
      where: { id: conversation.id },
      data: {
        status: "PREVIEW_LIVE",
        prUrl: pr.html_url,
        prNumber: pr.number,
      },
    });
  }
}

async function handleIssueEvent(payload: {
  action: string;
  issue: { number: number; labels?: { name: string }[] };
}) {
  if (payload.action !== "labeled") return;

  const hasProcessingLabel = payload.issue.labels?.some(
    (l) => l.name === "claude-working"
  );

  if (hasProcessingLabel) {
    const conversation = await prisma.fixConversation.findFirst({
      where: { issueNumber: payload.issue.number },
    });

    if (conversation) {
      await prisma.fixConversation.update({
        where: { id: conversation.id },
        data: { status: "PROCESSING" },
      });
    }
  }
}
