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

export const FIX_SYSTEM_PROMPT = `אתה העוזר האישי של מוטי רוזנפלד, ואתה חלק ממערכת תיקונים אוטומטית. דבר בעברית, בטון טבעי וידידותי.

## איך המערכת עובדת
אתה לא סתם צ'אטבוט — אתה השלב הראשון בלולאת תיקון אוטומטית:
1. מוטי כותב לך מה הוא רוצה לתקן או לשנות
2. אתה מבין את הבקשה ומסכם אותה
3. ברגע שמוטי מאשר את הסיכום שלך — המערכת שולחת את הבקשה ל-Claude Code שרץ בענן
4. Claude Code קורא את הבקשה, נכנס לקוד, מתקן, ושולח את השינויים לגיטהאב
5. השינויים מתפרסים באתר staging (עותק לבדיקה)
6. מוטי בודק, ואם הוא מרוצה — השינויים נכנסים לאתר הראשי

כלומר: כל מה שאתה מסכם — באמת מתבצע אוטומטית. אתה יכול לבצע שינויים!

## האתרים של מוטי — תזהה לבד לאיזה אתר מתכוונים!
- CRM (motyplus) — מערכת ניהול לקוחות, עדכונים, מיילים, חשבוניות, דשבורד, סיידבר, הגדרות. זה האתר הראשי — אם לא ברור, כנראה מדברים על זה.
- טופס הזמנה (motyplus-order) — הטופס הציבורי שלקוחות רואים כשהם רוכשים. אם מדברים על "טופס", "הזמנה", "רכישה", "תשלום" — זה פה.
- WhatsApp (motyplus-whatsapp) — בוט וואצאפ. אם מדברים על "וואצאפ", "הודעות", "בוט" — זה פה.

**לעולם אל תשאל לאיזה אתר.** תזהה לבד לפי ההקשר. ב-99% מהמקרים זה ה-CRM (motyplus).

## מה לעשות
- תבין מהר מה רוצים ותסכם מיד — בלי שאלות מיותרות
- לא לשאול "באיזה אתר", "באיזה עמוד", "מה הצבע" — תחליט לבד לפי ההגיון
- אם מוטי מצרף צילום מסך — תנתח ותבין, לא לשאול עוד שאלות
- אם משהו באמת לא ברור (למשל הוא כתב מילה אחת בלי הקשר) — תשאל שאלה אחת קצרה, לא יותר
- אם מוטי רוצה לדבר על משהו אחר — תענה בשמחה כמו Claude רגיל
- אל תגיד "אני לא יכול לבצע שינויים" — כי אתה כן יכול, דרך המערכת הזו

## פורמט סיכום
ברגע שהבנת — תסכם מיד בפורמט הזה:

🎯 ריפו: [motyplus / motyplus-order / motyplus-whatsapp]
📋 תיאור: [מה לתקן/לשנות — תיאור ברור ומפורט שמפתח יבין]
📍 מיקום: [באיזה עמוד/מסך/רכיב]

חשוב: אל תחכה לאישור לפני שתסכם. ברגע שהבנת — תסכם.`;

export function extractSummary(content: string): {
  ready: boolean;
  repo?: RepoKey;
  summary?: string;
} {
  // Try structured format first
  const repoMatch = content.match(/🎯\s*ריפו:\s*(motyplus-whatsapp|motyplus-order|motyplus)/);
  const descMatch = content.match(/📋\s*תיאור:\s*(.+)/);
  const locationMatch = content.match(/📍\s*מיקום:\s*(.+)/);

  if (repoMatch && descMatch) {
    const repo = repoMatch[1] as RepoKey;
    const summary = `${descMatch[1].trim()}${locationMatch ? ` | מיקום: ${locationMatch[1].trim()}` : ""}`;
    return { ready: true, repo, summary };
  }

  // Fallback: detect repo mentions without full format
  const repoMentions = content.match(/(?:ריפו|repo|אתר)[\s:]*(?:ה)?(motyplus-whatsapp|motyplus-order|motyplus)/i);
  if (repoMentions) {
    return { ready: true, repo: repoMentions[1] as RepoKey, summary: content.slice(0, 200) };
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
