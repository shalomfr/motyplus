import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, replaceTemplateVariables } from "@/lib/email";
import { logActivity } from "@/lib/activity-logger";

// POST /api/emails/send-bulk — שליחה קבוצתית: למי שלא מעודכן / חצאי סטים
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const body = await request.json();
    const { type } = body as { type: "not_updated" | "half_set" };

    if (!type || !["not_updated", "half_set"].includes(type)) {
      return NextResponse.json({ error: "סוג שליחה לא תקין" }, { status: 400 });
    }

    // מצא את העדכון האחרון
    const latestVersion = await prisma.updateVersion.findFirst({
      where: { status: { not: "DRAFT" } },
      orderBy: { sortOrder: "desc" },
    });

    // מצא תבנית מתאימה
    const templateName = type === "not_updated"
      ? "הצעת מחיר — למי שלא מעודכן"
      : "הצעה לחצאי סטים";

    const template = await prisma.emailTemplate.findFirst({
      where: { name: templateName },
    });

    if (!template) {
      return NextResponse.json({
        error: `לא נמצאה תבנית "${templateName}". טען את התבניות מחדש.`,
      }, { status: 400 });
    }

    // שאילתת לקוחות לפי סוג
    let customers;
    if (type === "not_updated") {
      // לקוחות עם סט שלם שלא מעודכנים
      customers = await prisma.customer.findMany({
        where: {
          status: { in: ["ACTIVE"] },
          setType: { includesUpdates: true },
          isCasual: false,
          OR: [
            { currentUpdateVersion: null },
            latestVersion
              ? { currentUpdateVersion: { not: latestVersion.version } }
              : {},
          ],
        },
        include: { organ: true, setType: true },
      });
    } else {
      // לקוחות עם חצי סט
      customers = await prisma.customer.findMany({
        where: {
          status: { in: ["ACTIVE"] },
          setType: { includesUpdates: false },
          isCasual: false,
        },
        include: { organ: true, setType: true },
      });
    }

    if (customers.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, message: "אין לקוחות מתאימים" });
    }

    let sent = 0;
    let failed = 0;

    for (const customer of customers) {
      const fullSetPrice = await prisma.setType.findFirst({
        where: { includesUpdates: true },
        select: { price: true },
      });

      const remainingForFullSet = fullSetPrice
        ? Math.max(0, Number(fullSetPrice.price) - Number(customer.amountPaid))
        : 0;

      const variables = {
        fullName: customer.fullName,
        firstName: customer.fullName.split(" ")[0],
        organ: customer.organ.name,
        setType: customer.setType.name,
        currentVersion: customer.currentUpdateVersion || "—",
        updateVersion: customer.currentUpdateVersion || "—",
        remainingAmount: String(remainingForFullSet),
        remainingForFullSet: `₪${remainingForFullSet}`,
        driveLink: "",
        youtubeLink: "",
        customLink: "",
      };

      const html = replaceTemplateVariables(template.body, variables);
      const subject = replaceTemplateVariables(template.subject, variables);

      try {
        const result = await sendEmail({ to: customer.email, subject, html });
        if (result.success) {
          sent++;
          await prisma.emailLog.create({
            data: {
              customerId: customer.id,
              templateId: template.id,
              toEmail: customer.email,
              subject,
              body: html,
              status: "SENT",
              sentAt: new Date(),
              userId: session.user.id,
            },
          });
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    await logActivity({
      userId: session.user.id,
      action: type === "not_updated" ? "BULK_EMAIL_NOT_UPDATED" : "BULK_EMAIL_HALF_SET",
      entityType: "EMAIL",
      entityId: "bulk",
      details: { type, sent, failed, total: customers.length },
    });

    return NextResponse.json({
      sent,
      failed,
      total: customers.length,
      message: `נשלחו ${sent} מיילים בהצלחה${failed > 0 ? `, ${failed} נכשלו` : ""}`,
    });
  } catch (error) {
    console.error("Error sending bulk emails:", error);
    return NextResponse.json({ error: "שגיאה בשליחה קבוצתית" }, { status: 500 });
  }
}
