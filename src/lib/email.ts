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
    const payload = {
      api_key: apiKey,
      to: [to],
      sender: from || `מוטי רוזנפלד <${process.env.SMTP_USER || "beats@mottirozenfeld.com"}>`,
      subject,
      html_body: html,
    };

    const res = await fetch(SMTP2GO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

// Hebrew label → English variable name mapping
// Allows {{גרסת_עדכון}} or {{גרסת עדכון}} to work as {{updateVersion}}
const HEBREW_ALIAS_MAP: Record<string, string> = {
  "שם_מלא": "fullName", "שם מלא": "fullName",
  "שם_פרטי": "firstName", "שם פרטי": "firstName",
  "מייל": "email",
  "טלפון": "phone",
  "אורגן": "organ",
  "סוג_סט": "setType", "סוג סט": "setType",
  "תאריך_רכישה": "purchaseDate", "תאריך רכישה": "purchaseDate",
  "תפוגת_עדכון": "updateExpiryDate", "תפוגת עדכון": "updateExpiryDate",
  "גרסה_נוכחית": "currentVersion", "גרסה נוכחית": "currentVersion",
  "גרסת_עדכון": "updateVersion", "גרסת עדכון": "updateVersion",
  "תאריך_שחרור": "releaseDate", "תאריך שחרור": "releaseDate",
  "סכום_ששולם": "amountPaid", "סכום ששולם": "amountPaid",
  "יתרה_לתשלום": "remainingAmount", "יתרה לתשלום": "remainingAmount",
  "יתרה_להשלמת_סט": "remainingForFullSet", "יתרה להשלמת סט": "remainingForFullSet",
  "קישור_דגימות": "samplesLink", "קישור דגימות": "samplesLink",
  "LINK_SAMPLES": "samplesLink",
  "קישור_מקצבים": "rhythmsLink", "קישור מקצבים": "rhythmsLink",
  "LINK_STYLES": "rhythmsLink",
  "קישור_דרייב": "driveLink", "קישור דרייב": "driveLink",
  "קישור_יוטיוב": "youtubeLink", "קישור יוטיוב": "youtubeLink",
  "קישור_חריג": "customLink", "קישור חריג": "customLink",
  "מזהה_לקוח": "customerId", "מזהה לקוח": "customerId",
  "לינק_תשלום_אישי": "paymentLink", "לינק תשלום אישי": "paymentLink",
  "לינק_טופס_הזמנה": "orderFormLink", "לינק טופס הזמנה": "orderFormLink",
  "קישור_לתקנון": "termsLink", "קישור לתקנון": "termsLink",
  "לקוח_חדש": "newCustomerName", "לקוח חדש": "newCustomerName",
  "תאריך_היום": "todayDate", "תאריך היום": "todayDate",
};

/**
 * Replace dynamic variables in email template
 * Variables format: {{variableName}} or {{שם_עברי}}
 * Each replaced value is wrapped in FSI/PDI to prevent BiDi reordering
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  // Strip invisible BiDi/zero-width characters around braces that can prevent matching
  let result = template.replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, "");

  // First pass: replace Hebrew aliases with English variable names
  for (const [hebrewKey, englishKey] of Object.entries(HEBREW_ALIAS_MAP)) {
    const escapedKey = hebrewKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, "g"), `{{${englishKey}}}`);
    result = result.replace(new RegExp(`(?<!\\{)\\{\\s*${escapedKey}\\s*\\}(?!\\})`, "g"), `{${englishKey}}`);
  }

  // Second pass: replace English variables with actual values
  for (const [key, value] of Object.entries(variables)) {
    const safeValue = value.replace(/\$/g, "$$$$");
    // Don't wrap URLs or data URIs in BiDi characters — they break href/src attributes
    const isUrl = /^https?:\/\//.test(value) || /^data:/.test(value);
    const isolated = isUrl ? safeValue : `${FSI}${safeValue}${PDI}`;
    // Replace {{var}} format (double braces)
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), isolated);
    // Replace {var} format (single braces)
    result = result.replace(new RegExp(`(?<!\\{)\\{\\s*${key}\\s*\\}(?!\\})`, "g"), isolated);
    // Replace <span data-var="var">...</span> format (from rich editor variable badges)
    result = result.replace(
      new RegExp(`<span[^>]*data-var=["']?${key}["']?[^>]*>[^<]*</span>`, "g"),
      isolated
    );
  }
  return result;
}
