import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/activity-logger";

// POST /api/customers/[id]/send-welcome-email - שליחת מייל ברכה לאחר רכישה
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
      return NextResponse.json({ error: "מזהה לקוח לא תקין" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { organ: true, setType: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "הלקוח לא נמצא" }, { status: 404 });
    }

    const html = `
<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">שלום ${customer.fullName},</h2>
  <p>תודה רבה על רכישת <strong>${customer.setType.name}</strong> לאורגן <strong>${customer.organ.name}</strong>!</p>
  <p>מספר הלקוח שלך: <strong>${customer.id}</strong></p>
  <br>
  <p>לכל שאלה או עזרה, ניתן לפנות אלינו בוואטסאפ.</p>
  <br>
  <p>בברכה,<br><strong>מוטי פלוס</strong></p>
</div>`;

    const result = await sendEmail({
      to: customer.email,
      subject: `ברוכים הבאים ל-MotyPlus! 🎹`,
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: "שגיאה בשליחת המייל" }, { status: 500 });
    }

    await logActivity({
      userId: session.user.id,
      customerId: customer.id,
      action: "EMAIL_WELCOME",
      entityType: "CUSTOMER",
      entityId: String(customer.id),
      details: { to: customer.email },
    });

    return NextResponse.json({ message: "מייל הברכה נשלח בהצלחה" });
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return NextResponse.json({ error: "שגיאה בשליחת המייל" }, { status: 500 });
  }
}
