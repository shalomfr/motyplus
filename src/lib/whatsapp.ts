/**
 * Convert Israeli phone number to WhatsApp chatId format
 * Examples: "050-837-7756" → "972508377756@s.whatsapp.net"
 *           "+972 50-837-7756" → "972508377756@s.whatsapp.net"
 */
export function phoneToWhatsAppId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return `${digits}@s.whatsapp.net`;
  if (digits.startsWith("0")) return `972${digits.slice(1)}@s.whatsapp.net`;
  return `972${digits}@s.whatsapp.net`;
}

interface SendWhatsAppParams {
  phone: string;
  message: string;
}

export async function sendWhatsApp({ phone, message }: SendWhatsAppParams): Promise<{ success: boolean; error?: unknown }> {
  const evolutionUrl = process.env.EVOLUTION_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE || "motyplus";

  if (!evolutionUrl || !apiKey) {
    console.log("WhatsApp not sent (no EVOLUTION credentials):", { phone });
    return { success: false, error: "No Evolution API credentials" };
  }

  const number = phoneToWhatsAppId(phone);

  try {
    const res = await fetch(
      `${evolutionUrl}/message/sendText/${instance}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": apiKey },
        body: JSON.stringify({ number, text: message }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error("WhatsApp send error:", error);
    return { success: false, error };
  }
}
