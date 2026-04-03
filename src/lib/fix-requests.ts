// Shared constants and helpers for the fix-requests system

export const REPOS = {
  motyplus: {
    label: "CRM",
    staging: "shalomfr/motyplus-staging",
    main: "shalomfr/motyplus",
  },
  "motyplus-order": {
    label: "טופס הזמנה",
    staging: "shalomfr/motyplus-order-staging",
    main: "shalomfr/motyplus-order",
  },
  "motyplus-whatsapp": {
    label: "וואצאפ",
    staging: "shalomfr/motyplus-whatsapp-staging",
    main: "shalomfr/motyplus-whatsapp",
  },
} as const;

export type RepoKey = keyof typeof REPOS;

export const REPO_KEYS = Object.keys(REPOS) as RepoKey[];

export const FIX_SYSTEM_PROMPT = `אתה עוזר אישי של מוטי רוזנפלד. דבר בעברית, בטון טבעי וידידותי. אל תטרטר בשאלות — תענה כמו Claude רגיל.

יש למוטי 3 אתרים:
- CRM (motyplus) — ניהול לקוחות, עדכונים, מיילים
- טופס הזמנה (motyplus-order) — טופס ציבורי לרכישה
- WhatsApp (motyplus-whatsapp) — בוט וואצאפ

כשמוטי מתאר בעיה או שינוי שהוא רוצה — תבין אותו מהר, תשאל רק אם באמת חסר לך מידע קריטי, ותסכם מתי שאתה מוכן בפורמט:

🎯 ריפו: [motyplus / motyplus-order / motyplus-whatsapp]
📋 תיאור: [מה לתקן/לשנות]
📍 מיקום: [איפה]

אם הבקשה ברורה מספיק — תסכם מיד בלי שאלות מיותרות.
אם מוטי רוצה לדבר על משהו אחר שלא קשור לתיקונים — תענה לו בשמחה כמו Claude רגיל.`;

export function extractSummary(content: string): {
  ready: boolean;
  repo?: RepoKey;
  summary?: string;
} {
  const repoMatch = content.match(/🎯\s*ריפו:\s*(motyplus-whatsapp|motyplus-order|motyplus)/);
  const descMatch = content.match(/📋\s*תיאור:\s*(.+)/);
  const locationMatch = content.match(/📍\s*מיקום:\s*(.+)/);

  if (repoMatch && descMatch) {
    const repo = repoMatch[1] as RepoKey;
    const summary = `${descMatch[1].trim()}${locationMatch ? ` | מיקום: ${locationMatch[1].trim()}` : ""}`;
    return { ready: true, repo, summary };
  }
  return { ready: false };
}

export async function callClaudeChat(
  messages: { role: string; content: string }[],
  hasImage = false
) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  // Build messages — parse JSON content blocks for vision messages
  const apiMessages = messages.map((m) => {
    if (m.role === "user" && m.content.startsWith("[")) {
      try {
        const parsed = JSON.parse(m.content);
        if (Array.isArray(parsed)) {
          return { role: "user" as const, content: parsed };
        }
      } catch {
        // not JSON, use as text
      }
    }
    // Strip screenshot markers from stored messages
    const cleanContent = m.content.replace(/\[screenshot:.*?\]\n?/, "");
    return {
      role: m.role as "user" | "assistant",
      content: cleanContent || m.content,
    };
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: FIX_SYSTEM_PROMPT,
      messages: apiMessages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.content[0].text as string;
}

export async function createGitHubIssue(
  repo: string,
  title: string,
  body: string
) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not configured");

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title,
      body,
      labels: ["auto-fix"],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error: ${res.status} ${err}`);
  }

  return res.json();
}

export async function getGitHubPRsForIssue(repo: string, issueNumber: number) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not configured");

  const res = await fetch(
    `https://api.github.com/repos/${repo}/pulls?state=all&sort=created&direction=desc&per_page=10`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!res.ok) return [];
  const prs = await res.json();
  return prs.filter(
    (pr: { body?: string }) =>
      pr.body?.includes(`#${issueNumber}`) ||
      pr.body?.includes(`issues/${issueNumber}`)
  );
}

export async function getRenderDeployStatus(serviceId: string) {
  const apiKey = process.env.RENDER_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `https://api.render.com/v1/services/${serviceId}/deploys?limit=1`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!res.ok) return null;
  const deploys = await res.json();
  return deploys[0] || null;
}
