import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const WA_URL = process.env.WHATSAPP_SERVICE_URL || "";
const WA_KEY = process.env.WHATSAPP_API_KEY || "";

// POST /api/whatsapp/send — send a WhatsApp message
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "לא מורשה" }, { status: 401 });

    if (!WA_URL) {
      return NextResponse.json({ error: "שירות WhatsApp לא מוגדר" }, { status: 400 });
    }

    const { phone, message } = await request.json();
    if (!phone || !message) {
      return NextResponse.json({ error: "חסר מספר טלפון או הודעה" }, { status: 400 });
    }

    const res = await fetch(`${WA_URL}/send`, {
      method: "POST",
      headers: { "apikey": WA_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ success: false, error: data.error || "שליחה נכשלה" }, { status: res.status });
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("WhatsApp send error:", error);
    return NextResponse.json({ success: false, error: "שגיאה בשליחת הודעה" }, { status: 500 });
  }
}
