import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/crypto";

// GET /api/integrations/billing — רשימת ספקי חיוב
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const providers = await prisma.billingProvider.findMany({
      orderBy: { createdAt: "desc" },
    });

    // מחזיר עם apiKey מוסתר חלקית
    const safe = providers.map((p) => ({
      ...p,
      apiKey: maskString(decrypt(p.apiKey)),
      apiSecret: p.apiSecret ? "••••••••" : null,
    }));

    return NextResponse.json(safe);
  } catch (error) {
    console.error("Error fetching billing providers:", error);
    return NextResponse.json({ error: "שגיאה בטעינת ספקי חיוב" }, { status: 500 });
  }
}

// POST /api/integrations/billing — הוספה/עדכון ספק
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const body = await request.json();
    const { provider, apiKey, apiSecret, displayName, settings } = body;

    if (!provider || !apiKey) {
      return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
    }

    // בדיקה אם כבר קיים ספק מאותו סוג
    const existing = await prisma.billingProvider.findFirst({
      where: { provider, userId: session.user.id },
    });

    if (existing) {
      // עדכון
      const updated = await prisma.billingProvider.update({
        where: { id: existing.id },
        data: {
          apiKey: encrypt(apiKey),
          apiSecret: apiSecret ? encrypt(apiSecret) : existing.apiSecret,
          displayName: displayName || existing.displayName,
          settings: settings || existing.settings,
          lastError: null,
        },
      });
      return NextResponse.json({ id: updated.id, message: "ספק עודכן" });
    }

    // יצירה חדשה
    const created = await prisma.billingProvider.create({
      data: {
        userId: session.user.id,
        provider,
        displayName: displayName || provider,
        apiKey: encrypt(apiKey),
        apiSecret: apiSecret ? encrypt(apiSecret) : null,
        isPrimary: true,
        settings: settings || null,
      },
    });

    return NextResponse.json({ id: created.id, message: "ספק נוסף" }, { status: 201 });
  } catch (error) {
    console.error("Error saving billing provider:", error);
    return NextResponse.json({ error: "שגיאה בשמירת ספק חיוב" }, { status: 500 });
  }
}

function maskString(str: string): string {
  if (str.length <= 4) return "••••";
  return str.slice(0, 2) + "••••" + str.slice(-2);
}
