import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import crypto from "crypto";

// POST /api/customers/[id]/upload-link — יצירת קישור חד-פעמי להעלאת אינפו
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { id } = await params;
    const customerId = parseInt(id);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "מזהה לא תקין" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, fullName: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }

    // יצירת טוקן ייחודי ושמירה ב-SystemSetting
    const token = crypto.randomBytes(24).toString("hex");
    const key = `upload-token:${token}`;
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ימים

    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: JSON.stringify({ customerId, expiresAt: expiry.toISOString() }) },
      create: { key, value: JSON.stringify({ customerId, expiresAt: expiry.toISOString() }) },
    });

    const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "";
    const link = `${baseUrl}/upload-info/${token}`;

    return NextResponse.json({ link, token, expiresAt: expiry });
  } catch (error) {
    console.error("Error creating upload link:", error);
    return NextResponse.json({ error: "שגיאה ביצירת קישור" }, { status: 500 });
  }
}
