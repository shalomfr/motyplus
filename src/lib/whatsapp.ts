interface SendWhatsAppParams {
  phone: string;
  message: string;
}

export async function sendWhatsApp({ phone, message }: SendWhatsAppParams): Promise<{ success: boolean; error?: unknown }> {
  const waUrl = process.env.WHATSAPP_SERVICE_URL;
  const apiKey = process.env.WHATSAPP_API_KEY;

  if (!waUrl || !apiKey) {
    console.log("WhatsApp not sent (no credentials):", { phone });
    return { success: false, error: "No WhatsApp service credentials" };
  }

  try {
    const res = await fetch(`${waUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": apiKey },
      body: JSON.stringify({ phone, message }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error("WhatsApp send error:", error);
    return { success: false, error };
  }
}
