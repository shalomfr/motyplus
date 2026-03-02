import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";
import { logActivity } from "@/lib/activity-logger";

// POST /api/customers/[id]/send-update-request - שליחת בקשת הכנת עדכון לאדמין
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

    const adminEmail = process.env.ADMIN_EMAIL || "admin@motyplus.com";

    const html = `
<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a2e;">בקשת הכנת עדכון</h2>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 6px; font-weight: bold;">שם הלקוח:</td><td style="padding: 6px;">${customer.fullName}</td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">מזהה:</td><td style="padding: 6px;">${customer.id}</td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">אורגן:</td><td style="padding: 6px;">${customer.organ.name}</td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">סוג סט:</td><td style="padding: 6px;">${customer.setType.name}</td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">פלאפון:</td><td style="padding: 6px;">${customer.phone}</td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">מייל:</td><td style="padding: 6px;">${customer.email}</td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">גרסה נוכחית:</td><td style="padding: 6px;">${customer.currentUpdateVersion || "לא עודכן"}</td></tr>
    <tr><td style="padding: 6px; font-weight: bold;">סוג דגימה:</td><td style="padding: 6px;">${customer.sampleType}</td></tr>
  </table>
  <br>
  <p style="color: #666; font-size: 12px;">נשלח ע"י ${session.user.name || session.user.email} • ${new Date().toLocaleString("he-IL")}</p>
</div>`;

    const result = await sendEmail({
      to: adminEmail,
      subject: `הכנת עדכון עבור ${customer.fullName} (#${customer.id})`,
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: "שגיאה בשליחת ההודעה" }, { status: 500 });
    }

    // וואטסאפ לאדמין (המספר של מוטי)
    const adminPhone = process.env.ADMIN_WHATSAPP || process.env.ADMIN_EMAIL;
    if (adminPhone && !adminPhone.includes("@")) {
      const waMsg = `*בקשת הכנת עדכון*\nלקוח: ${customer.fullName} (#${customer.id})\nאורגן: ${customer.organ.name}\nסט: ${customer.setType.name}\nפלאפון: ${customer.phone}\nגרסה: ${customer.currentUpdateVersion || "לא עודכן"}\nסוג דגימה: ${customer.sampleType}`;
      sendWhatsApp({ phone: adminPhone, message: waMsg }).catch(console.error);
    }

    await logActivity({
      userId: session.user.id,
      customerId: customer.id,
      action: "UPDATE_REQUEST",
      entityType: "CUSTOMER",
      entityId: String(customer.id),
      details: { sentTo: adminEmail },
    });

    return NextResponse.json({ message: "בקשת הכנת העדכון נשלחה בהצלחה" });
  } catch (error) {
    console.error("Error sending update request:", error);
    return NextResponse.json({ error: "שגיאה בשליחת הבקשה" }, { status: 500 });
  }
}
