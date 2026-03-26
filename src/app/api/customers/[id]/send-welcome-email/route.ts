import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, replaceTemplateVariables } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";
import { logActivity } from "@/lib/activity-logger";

// POST /api/customers/[id]/send-welcome-email - שליחת מייל ברכה לאחר רכישה / עדכון
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

    // בדיקה אם זה מצב עדכון (לקוח קיים שקנה עדכון)
    const body = await request.json().catch(() => ({}));
    const updateOnly = body?.updateOnly === true;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { organ: true, setType: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "הלקוח לא נמצא" }, { status: 404 });
    }

    // טעינת תבנית מה-DB — "ברכת עדכון" ללקוח קיים, "ברכת קנייה" ללקוח חדש
    const templateName = updateOnly ? "ברכת עדכון" : "ברכת קנייה";
    const template = await prisma.emailTemplate.findFirst({
      where: { name: templateName },
    });

    const variables = {
      customerName: customer.fullName,
      setType: customer.setType.name,
      organName: customer.organ.name,
      customerId: String(customer.id),
      orderFormLink: "https://motyplus-order.onrender.com/",
      termsLink: "https://motyplus-order.onrender.com/terms",
      todayDate: new Date().toLocaleDateString("he-IL"),
    };

    const html = template
      ? replaceTemplateVariables(template.body, variables)
      : `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>שלום ${customer.fullName},</h2>
  <p>תודה רבה על רכישת <strong>${customer.setType.name}</strong> לאורגן <strong>${customer.organ.name}</strong>!</p>
  <p>מספר הלקוח שלך: <strong>${customer.id}</strong></p>
  <p>בברכה,<br><strong>מוטי פלוס</strong></p>
</div>`;

    const subject = template
      ? replaceTemplateVariables(template.subject, variables)
      : `ברוכים הבאים ל-Motty Beats!`;

    const result = await sendEmail({
      to: customer.email,
      subject,
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: "שגיאה בשליחת המייל" }, { status: 500 });
    }

    // רישום לוג מייל
    await prisma.emailLog.create({
      data: {
        customerId: customer.id,
        toEmail: customer.email,
        subject,
        status: "SENT",
        sentAt: new Date(),
        userId: session.user.id,
      },
    });

    // שליחת וואטסאפ במקביל (לא חוסם אם נכשל)
    const whatsappMessage = `שלום ${customer.fullName}!\nתודה על רכישת *${customer.setType.name}* לאורגן *${customer.organ.name}*.\nמספר לקוח: ${customer.id}\nלכל שאלה - כאן בשבילך 🎹`;
    const phone = customer.whatsappPhone || customer.phone;
    if (phone) {
      sendWhatsApp({ phone, message: whatsappMessage }).catch(console.error);
    }

    await logActivity({
      userId: session.user.id,
      customerId: customer.id,
      action: updateOnly ? "EMAIL_WELCOME_UPDATE" : "EMAIL_WELCOME",
      entityType: "CUSTOMER",
      entityId: String(customer.id),
      details: { to: customer.email, whatsapp: phone, updateOnly },
    });

    return NextResponse.json({ message: "מייל הברכה נשלח בהצלחה" });
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return NextResponse.json({ error: "שגיאה בשליחת המייל" }, { status: 500 });
  }
}
