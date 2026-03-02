import nodemailer from "nodemailer";

let _transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "mail-eu.smtp2go.com",
      port: parseInt(process.env.SMTP_PORT || "2525"),
      secure: false, // TLS via STARTTLS
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      },
    });
  }
  return _transporter;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams) {
  if (!process.env.SMTP_PASS) {
    console.log("Email not sent (no SMTP_PASS configured):", { to, subject });
    return { success: false, error: "No SMTP credentials configured" };
  }

  try {
    const info = await getTransporter().sendMail({
      from: from || `MotyPlus <${process.env.SMTP_USER || "noreply@mottirozenfeld.com"}>`,
      to,
      subject,
      html,
    });

    return { success: true, data: info };
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
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}
