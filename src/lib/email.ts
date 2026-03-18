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
        sender: from || `Motty Beats <${process.env.SMTP_USER || "beats@mottirozenfeld.com"}>`,
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

/**
 * Replace dynamic variables in email template
 * Variables format: {{variableName}}
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    // Replace {{var}} format
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    // Replace <span data-var="var">...</span> format (from rich editor variable badges)
    result = result.replace(
      new RegExp(`<span[^>]*data-var="${key}"[^>]*>[^<]*</span>`, "g"),
      value
    );
  }
  return result;
}
