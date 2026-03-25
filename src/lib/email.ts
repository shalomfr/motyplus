const SMTP2GO_API_URL = "https://api.smtp2go.com/v3/email/send";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams) {
  const apiKey = process.env.SMTP2GO_API_KEY;

  if (!apiKey) {
    console.log("Email not sent (no SMTP2GO_API_KEY configured):", { to, subject });
    return { success: false, error: "No SMTP2GO API key configured" };
  }

  try {
    const res = await fetch(SMTP2GO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        to: [to],
        sender: from || `מוטי רוזנפלד <${process.env.SMTP_USER || "beats@mottirozenfeld.com"}>`,
        subject,
        html_body: html,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.data?.error) {
      throw new Error(data.data?.error || `HTTP ${res.status}`);
    }

    return { success: true, data };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error };
  }
}

// Unicode BiDi isolation characters — prevent mixed-direction values
// from being reordered by the BiDi algorithm in RTL context
const FSI = "\u2068"; // First Strong Isolate
const PDI = "\u2069"; // Pop Directional Isolate

/**
 * Replace dynamic variables in email template
 * Variables format: {{variableName}}
 * Each replaced value is wrapped in FSI/PDI to prevent BiDi reordering
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  // Strip invisible BiDi/zero-width characters around braces that can prevent matching
  let result = template.replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, "");
  for (const [key, value] of Object.entries(variables)) {
    // Escape regex special characters in value to prevent injection
    const safeValue = value.replace(/\$/g, "$$$$");
    const isolated = `${FSI}${safeValue}${PDI}`;
    // Replace {{var}} format (double braces)
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), isolated);
    // Replace {var} format (single braces — common typo in subject lines)
    result = result.replace(new RegExp(`(?<!\\{)\\{\\s*${key}\\s*\\}(?!\\})`, "g"), isolated);
    // Replace <span data-var="var">...</span> format (from rich editor variable badges)
    result = result.replace(
      new RegExp(`<span[^>]*data-var=["']?${key}["']?[^>]*>[^<]*</span>`, "g"),
      isolated
    );
  }
  return result;
}
