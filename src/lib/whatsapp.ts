const GREENAPI_BASE = "https://api.green-api.com";

/**
 * Convert Israeli phone number to Green API chatId format
 * Examples: "050-837-7756" → "972508377756@c.us"
 *           "+972 50-837-7756" → "972508377756@c.us"
 *           "0508377756" → "972508377756@c.us"
 */
export function phoneToWhatsAppId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return `${digits}@c.us`;
  if (digits.startsWith("0")) return `972${digits.slice(1)}@c.us`;
  return `972${digits}@c.us`;
}

interface SendWhatsAppParams {
  phone: string;
  message: string;
}

export async function sendWhatsApp({ phone, message }: SendWhatsAppParams): Promise<{ success: boolean; error?: unknown }> {
  const instanceId = process.env.GREENAPI_INSTANCE;
  const token = process.env.GREENAPI_TOKEN;

  if (!instanceId || !token) {
    console.log("WhatsApp not sent (no GREENAPI credentials):", { phone });
    return { success: false, error: "No Green API credentials" };
  }

  const chatId = phoneToWhatsAppId(phone);

  try {
    const res = await fetch(
      `${GREENAPI_BASE}/waInstance${instanceId}/sendMessage/${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message }),
      }
    );

    const data = await res.json();

    if (!res.ok || data.statusCode === 400) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error("WhatsApp send error:", error);
    return { success: false, error };
  }
}
