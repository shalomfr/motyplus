import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/activity-logger";
import crypto from "crypto";

// POST /api/customers/[id]/send-upload-link — יצירת קישור וגם שליחתו במייל ללקוח
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
      select: { id: true, fullName: true, email: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }

    if (!customer.email) {
      return NextResponse.json({ error: "אין כתובת מייל ללקוח" }, { status: 400 });
    }

    // יצירת טוקן ייחודי
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

    // שליחת מייל
    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a;">שלום ${customer.fullName},</h2>
        <p style="font-size: 16px; color: #333;">
          לחץ על הכפתור למטה כדי להעלות את קובץ האינפו שלך:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${link}"
             style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
            העלאת קובץ אינפו
          </a>
        </div>
        <p style="font-size: 13px; color: #666;">
          הקישור תקף ל-7 ימים ולשימוש חד-פעמי בלבד.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999;">Motty Beats</p>
      </div>
    `;

    const result = await sendEmail({
      to: customer.email,
      subject: "העלאת קובץ אינפו — Motty Beats",
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: "שגיאה בשליחת המייל" }, { status: 500 });
    }

    // רישום פעילות
    await logActivity({
      userId: session.user.id,
      action: "SEND_EMAIL",
      entityType: "Customer",
      entityId: String(customerId),
      details: { type: "upload-link", email: customer.email },
    }).catch(() => {});

    return NextResponse.json({ success: true, link });
  } catch (error) {
    console.error("Error sending upload link:", error);
    return NextResponse.json({ error: "שגיאה בשליחת קישור" }, { status: 500 });
  }
}
