import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const WA_URL = process.env.WHATSAPP_SERVICE_URL || "";
const WA_KEY = process.env.WHATSAPP_API_KEY || "";

function waHeaders() {
  return { "apikey": WA_KEY, "Content-Type": "application/json" };
}

// GET /api/whatsapp — status + QR code
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "לא מורשה" }, { status: 401 });

    if (!WA_URL) {
      return NextResponse.json({ configured: false, status: "not_configured" });
    }

    const res = await fetch(`${WA_URL}/status`, { headers: waHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("WhatsApp status error:", error);
    return NextResponse.json({ configured: false, status: "error", error: String(error) });
  }
}

// POST /api/whatsapp — connect or disconnect
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "לא מורשה" }, { status: 401 });

    if (!WA_URL) {
      return NextResponse.json({ error: "WhatsApp service לא מוגדר" }, { status: 400 });
    }

    const { action } = await request.json();

    if (action === "connect" || action === "create") {
      const res = await fetch(`${WA_URL}/connect`, {
        method: "POST",
        headers: waHeaders(),
      });
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === "disconnect" || action === "delete") {
      const res = await fetch(`${WA_URL}/disconnect`, {
        method: "POST",
        headers: waHeaders(),
      });
      const data = await res.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "פעולה לא ידועה" }, { status: 400 });
  } catch (error) {
    console.error("WhatsApp action error:", error);
    return NextResponse.json({ error: "שגיאה בפעולה" }, { status: 500 });
  }
}
