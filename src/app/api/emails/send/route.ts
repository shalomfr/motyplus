import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity-logger";
import { sendEmail, replaceTemplateVariables } from "@/lib/email";

interface SendEmailBody {
  templateId?: string;
  subject?: string;
  body?: string;
  customerIds?: number[];
  leadIds?: string[];
}

// POST /api/emails/send - שליחת מייל ללקוחות
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "לא מורשה. יש להתחבר למערכת" },
        { status: 401 }
      );
    }

    const body: SendEmailBody = await request.json();
    const { templateId, subject, body: emailBody, customerIds, leadIds } = body;

    // וידוא שיש תבנית או נושא+תוכן
    let finalSubject = subject || "";
    let finalBody = emailBody || "";

    if (templateId) {
      const template = await prisma.emailTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        return NextResponse.json(
          { error: "תבנית המייל לא נמצאה" },
          { status: 404 }
        );
      }

      finalSubject = template.subject;
      finalBody = template.body;
    } else if (!subject || !emailBody) {
      return NextResponse.json(
        { error: "יש לספק תבנית מייל או נושא ותוכן" },
        { status: 400 }
      );
    }

    const results: { success: boolean; email: string; error?: string }[] = [];

    // שליחה ללקוחות
    if (customerIds && customerIds.length > 0) {
      const customers = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        include: { organ: true, setType: true },
      });

      for (const customer of customers) {
        // החלפת משתנים דינמיים
        const variables: Record<string, string> = {
          fullName: customer.fullName,
          firstName: customer.fullName.split(" ")[0],
          email: customer.email,
          phone: customer.phone,
          organ: customer.organ.name,
          setType: customer.setType.name,
          purchaseDate: customer.purchaseDate.toLocaleDateString("he-IL"),
          updateExpiryDate: customer.updateExpiryDate.toLocaleDateString("he-IL"),
        };

        const personalizedSubject = replaceTemplateVariables(finalSubject, variables);
        const personalizedBody = replaceTemplateVariables(finalBody, variables);

        const result = await sendEmail({
          to: customer.email,
          subject: personalizedSubject,
          html: personalizedBody,
        });

        // יצירת רשומת לוג
        await prisma.emailLog.create({
          data: {
            customerId: customer.id,
            templateId: templateId || null,
            toEmail: customer.email,
            subject: personalizedSubject,
            body: personalizedBody,
            status: result.success ? "SENT" : "FAILED",
            sentAt: result.success ? new Date() : null,
            userId: session.user.id,
          },
        });

        results.push({
          success: result.success,
          email: customer.email,
          error: result.success ? undefined : String(result.error),
        });
      }
    }

    // שליחה ללידים
    if (leadIds && leadIds.length > 0) {
      const leads = await prisma.lead.findMany({
        where: {
          id: { in: leadIds },
          email: { not: null },
        },
      });

      for (const lead of leads) {
        if (!lead.email) continue;

        const variables: Record<string, string> = {
          fullName: lead.fullName,
          firstName: lead.fullName.split(" ")[0],
          email: lead.email,
          phone: lead.phone,
        };

        const personalizedSubject = replaceTemplateVariables(finalSubject, variables);
        const personalizedBody = replaceTemplateVariables(finalBody, variables);

        const result = await sendEmail({
          to: lead.email,
          subject: personalizedSubject,
          html: personalizedBody,
        });

        await prisma.emailLog.create({
          data: {
            leadId: lead.id,
            templateId: templateId || null,
            toEmail: lead.email,
            subject: personalizedSubject,
            body: personalizedBody,
            status: result.success ? "SENT" : "FAILED",
            sentAt: result.success ? new Date() : null,
            userId: session.user.id,
          },
        });

        results.push({
          success: result.success,
          email: lead.email,
          error: result.success ? undefined : String(result.error),
        });
      }
    }

    if (results.length === 0) {
      return NextResponse.json(
        { error: "לא נמצאו נמענים לשליחה" },
        { status: 400 }
      );
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    await logActivity({
      userId: session.user.id,
      action: "SEND_EMAIL",
      entityType: "EMAIL",
      entityId: templateId || "custom",
      details: {
        totalSent: successCount,
        totalFailed: failCount,
        templateId,
      },
    });

    return NextResponse.json({
      message: `נשלחו ${successCount} מיילים בהצלחה${failCount > 0 ? `, ${failCount} נכשלו` : ""}`,
      results,
      successCount,
      failCount,
    });
  } catch (error) {
    console.error("Error sending emails:", error);
    return NextResponse.json(
      { error: "שגיאה בשליחת המיילים" },
      { status: 500 }
    );
  }
}
