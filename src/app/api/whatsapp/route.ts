import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const EVOLUTION_URL = process.env.EVOLUTION_URL || "";
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || "";
const INSTANCE = process.env.EVOLUTION_INSTANCE || "motyplus";

function evolutionHeaders() {
  return { "apikey": EVOLUTION_KEY, "Content-Type": "application/json" };
}

// GET /api/whatsapp — status + QR code
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "לא מורשה" }, { status: 401 });

    if (!EVOLUTION_URL) {
      return NextResponse.json({ configured: false, status: "not_configured" });
    }

    // Check connection state
    const stateRes = await fetch(
      `${EVOLUTION_URL}/instance/connectionState/${INSTANCE}`,
      { headers: evolutionHeaders() }
    );

    if (stateRes.status === 404) {
      // Instance doesn't exist yet
      return NextResponse.json({ configured: true, status: "not_created" });
    }

    const stateData = await stateRes.json();
    const state = stateData.instance?.state || stateData.state || "unknown";

    if (state === "open") {
      return NextResponse.json({
        configured: true,
        status: "connected",
        phone: stateData.instance?.profileName || stateData.profileName,
      });
    }

    // Not connected — get QR code
    const connectRes = await fetch(
      `${EVOLUTION_URL}/instance/connect/${INSTANCE}`,
      { headers: evolutionHeaders() }
    );
    const connectData = await connectRes.json();

    return NextResponse.json({
      configured: true,
      status: "disconnected",
      qrcode: connectData.base64 || connectData.qrcode?.base64 || null,
      pairingCode: connectData.code || null,
    });
  } catch (error) {
    console.error("WhatsApp status error:", error);
    return NextResponse.json({ configured: false, status: "error", error: String(error) });
  }
}

// POST /api/whatsapp — create instance or disconnect
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "לא מורשה" }, { status: 401 });

    if (!EVOLUTION_URL) {
      return NextResponse.json({ error: "Evolution API לא מוגדר" }, { status: 400 });
    }

    const { action } = await request.json();

    if (action === "create") {
      const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: "POST",
        headers: evolutionHeaders(),
        body: JSON.stringify({
          instanceName: INSTANCE,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === "disconnect") {
      await fetch(`${EVOLUTION_URL}/instance/logout/${INSTANCE}`, {
        method: "DELETE",
        headers: evolutionHeaders(),
      });
      return NextResponse.json({ message: "מנותק בהצלחה" });
    }

    if (action === "delete") {
      await fetch(`${EVOLUTION_URL}/instance/delete/${INSTANCE}`, {
        method: "DELETE",
        headers: evolutionHeaders(),
      });
      return NextResponse.json({ message: "האינסטנס נמחק" });
    }

    return NextResponse.json({ error: "פעולה לא ידועה" }, { status: 400 });
  } catch (error) {
    console.error("WhatsApp action error:", error);
    return NextResponse.json({ error: "שגיאה בפעולה" }, { status: 500 });
  }
}
