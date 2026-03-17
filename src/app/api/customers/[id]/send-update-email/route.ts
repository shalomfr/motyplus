import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, replaceTemplateVariables } from "@/lib/email";
import { logActivity } from "@/lib/activity-logger";

// POST /api/customers/[id]/send-update-email — שליחת מקצבים/דגימות + שדרוג אוטומטי
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

    const body = await request.json().catch(() => ({}));
    const { samplesOnly, includeSamples } = body as {
      samplesOnly?: boolean;
      includeSamples?: boolean;
    };

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { organ: true, setType: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "הלקוח לא נמצא" }, { status: 404 });
    }

    // מצא את העדכון האחרון
    const latestVersion = await prisma.updateVersion.findFirst({
      where: { status: { not: "DRAFT" } },
      orderBy: { sortOrder: "desc" },
      include: {
        updateFiles: {
          where: {
            organId: customer.organId,
            setTypeId: customer.setTypeId,
          },
        },
      },
    });

    if (!latestVersion) {
      return NextResponse.json({ error: "אין עדכונים זמינים" }, { status: 400 });
    }

    // בניית קישורים
    const updateFile = latestVersion.updateFiles[0];
    const rhythmsLink = latestVersion.rhythmsFileUrl || "";
    const downloadLink = updateFile?.fileUrl || rhythmsLink;

    // טעינת תבנית
    const templateName = samplesOnly
      ? "שליחת דגימות"
      : includeSamples
        ? "שליחת מקצבים ודגימות"
        : "שליחת עדכון";

    const template = await prisma.emailTemplate.findFirst({
      where: { name: templateName },
    });

    const variables = {
      customerName: customer.fullName,
      version: latestVersion.version,
      downloadLink,
      downloadLink2: "",
      rhythmsLink,
      organName: customer.organ.name,
      setType: customer.setType.name,
      customerId: String(customer.id),
    };

    const html = template
      ? replaceTemplateVariables(template.body, variables)
      : latestVersion.emailBody
        ? replaceTemplateVariables(latestVersion.emailBody, variables)
        : `<div dir="rtl"><p>שלום ${customer.fullName},</p><p>עדכון ${latestVersion.version} מוכן עבורך.</p><p>${downloadLink ? `<a href="${downloadLink}">לחץ להורדה</a>` : ""}</p></div>`;

    const subject = template
      ? replaceTemplateVariables(template.subject, variables)
      : latestVersion.emailSubject
        ? replaceTemplateVariables(latestVersion.emailSubject, variables)
        : `עדכון ${latestVersion.version} מוכן עבורך`;

    const result = await sendEmail({
      to: customer.email,
      subject,
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: "שגיאה בשליחת המייל" }, { status: 500 });
    }

    // שדרוג אוטומטי — עדכון currentUpdateVersion ללקוח
    if (!samplesOnly) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { currentUpdateVersion: latestVersion.version },
      });

      // יצירת/עדכון רשומת CustomerUpdate
      await prisma.customerUpdate.upsert({
        where: {
          customerId_updateVersionId: {
            customerId,
            updateVersionId: latestVersion.id,
          },
        },
        create: {
          customerId,
          updateVersionId: latestVersion.id,
          updateFileId: updateFile?.id || null,
          sentAt: new Date(),
          sentById: session.user.id,
        },
        update: {
          sentAt: new Date(),
          sentById: session.user.id,
        },
      });
    }

    // יומן פעילות
    await logActivity({
      userId: session.user.id,
      customerId: customer.id,
      action: samplesOnly ? "EMAIL_SAMPLES" : "EMAIL_UPDATE",
      entityType: "CUSTOMER",
      entityId: String(customer.id),
      details: {
        to: customer.email,
        version: latestVersion.version,
        samplesOnly,
        includeSamples,
      },
    });

    // רישום EmailLog
    await prisma.emailLog.create({
      data: {
        customerId,
        toEmail: customer.email,
        subject,
        body: html,
        status: "SENT",
        sentAt: new Date(),
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      message: "המייל נשלח בהצלחה",
      version: latestVersion.version,
      upgraded: !samplesOnly,
    });
  } catch (error) {
    console.error("Error sending update email:", error);
    return NextResponse.json({ error: "שגיאה בשליחת מייל העדכון" }, { status: 500 });
  }
}
