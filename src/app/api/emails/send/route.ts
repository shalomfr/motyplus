import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity-logger";
import { sendEmail, replaceTemplateVariables } from "@/lib/email";
import { listFiles, shareFile, getShareableLink } from "@/lib/file-storage";
import { parseCpiFilename } from "@/lib/cpi-filename";
import { getBillingClient } from "@/lib/billing";
import { ORDER_FORM_URL, TERMS_URL } from "@/lib/utils";

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

    // הגבלת מספר נמענים
    const totalRecipients = (customerIds?.length || 0) + (leadIds?.length || 0);
    if (totalRecipients > 500) {
      return NextResponse.json(
        { error: "לא ניתן לשלוח ליותר מ-500 נמענים בבקשה אחת" },
        { status: 400 }
      );
    }

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

      // בדיקה האם התבנית מכילה משתני קישורים (samplesLink / rhythmsLink)
      // Fetch latest update version for updateVersion variable
      const latestUpdateVersion = await prisma.updateVersion.findFirst({
        where: { status: { not: "DRAFT" } },
        orderBy: { sortOrder: "desc" },
        select: { version: true },
      });

      const needsLinks = finalBody.includes("samplesLink") || finalBody.includes("rhythmsLink")
        || finalSubject.includes("samplesLink") || finalSubject.includes("rhythmsLink");

      // בניית מפות קישורים אם צריך
      let cpiMap = new Map<number, { main?: string; additional?: string }>();
      let rhythmsLinkMap = new Map<string, string>();

      if (needsLinks) {
        // קבצי CPI (דגימות) לכל לקוח
        try {
          const sampleFiles = await listFiles("updates/samples");
          for (const f of sampleFiles) {
            const name = f.path.split("/").pop() || "";
            const parsed = parseCpiFilename(name);
            if (parsed.customerId === null) continue;
            if (!cpiMap.has(parsed.customerId)) cpiMap.set(parsed.customerId, {});
            const entry = cpiMap.get(parsed.customerId)!;
            if (parsed.isAdditional) entry.additional = f.path;
            else entry.main = f.path;
          }
        } catch (err) {
          console.error("Error listing sample files:", err);
        }

        // קישורי מקצבים לפי אורגן וסוג סט
        try {
          const latestVersion = await prisma.updateVersion.findFirst({
            where: { status: { not: "DRAFT" } },
            orderBy: { sortOrder: "desc" },
          });

          if (latestVersion) {
            const [allOrgans, allSetTypes] = await Promise.all([
              prisma.organ.findMany({ select: { id: true, demoAlias: true } }),
              prisma.setType.findMany({ select: { id: true, demoAlias: true } }),
            ]);
            const organAliasMap = new Map(allOrgans.map(o => [o.id, o.demoAlias]));
            const setTypeAliasMap = new Map(allSetTypes.map(st => [st.id, st.demoAlias]));

            const uniqueCombos = new Set(customers.map(c => `${c.organId}_${c.setTypeId}`));
            for (const combo of uniqueCombos) {
              const [organId, setTypeId] = combo.split("_");
              const organAlias = organAliasMap.get(organId);
              const setTypeAlias = setTypeAliasMap.get(setTypeId);
              if (!organAlias || !setTypeAlias) continue;

              const folderPath = `updates/beats/${organAlias}/${setTypeAlias}/${latestVersion.version} - ${organAlias}`;
              try {
                rhythmsLinkMap.set(combo, await getShareableLink(folderPath));
              } catch (err) {
                console.error(`Rhythms folder not found: ${folderPath}`, err);
              }
            }
          }
        } catch (err) {
          console.error("Error building rhythms links:", err);
        }
      }

      for (const customer of customers) {
        // החלפת משתנים דינמיים (#30/#31: משתנים כספיים)
        const setPrice = Number(customer.setType.price || 0);
        const paid = Number(customer.amountPaid || 0);
        const remaining = Math.max(0, setPrice - paid);

        // קישור דגימות — שיתוף קובץ CPI עם הלקוח
        let samplesLink = "";
        if (needsLinks) {
          const cpiFiles = cpiMap.get(customer.id);
          if (cpiFiles?.main) {
            try {
              samplesLink = await shareFile(cpiFiles.main, customer.email, "reader");
            } catch (err) {
              console.error(`Failed to share CPI for customer ${customer.id}:`, err);
            }
          }
        }

        // Use redirect URL — creates fresh payment link when customer clicks
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.AUTH_URL || "";
        const paymentLink = remaining > 0 ? `${baseUrl}/pay/${customer.id}` : "";

        const variables: Record<string, string> = {
          fullName: customer.fullName,
          firstName: customer.fullName.split(" ")[0],
          email: customer.email,
          phone: customer.phone,
          organ: customer.organ.name,
          setType: customer.setType.name,
          purchaseDate: customer.purchaseDate ? customer.purchaseDate.toLocaleDateString("he-IL") : "",
          updateExpiryDate: customer.updateExpiryDate ? customer.updateExpiryDate.toLocaleDateString("he-IL") : "",
          amountPaid: paid.toLocaleString("he-IL"),
          remainingAmount: remaining.toLocaleString("he-IL"),
          remainingForFullSet: remaining > 0 ? `${remaining.toLocaleString("he-IL")} ₪` : "שולם במלואו",
          currentVersion: customer.currentUpdateVersion || "לא עודכן",
          updateVersion: latestUpdateVersion?.version || "—",
          samplesLink,
          rhythmsLink: rhythmsLinkMap.get(`${customer.organId}_${customer.setTypeId}`) || "",
          driveLink: "",
          youtubeLink: "",
          customLink: "",
          paymentLink,
          customerId: String(customer.id),
          orderFormLink: `${ORDER_FORM_URL}/`,
          termsLink: TERMS_URL,
          todayDate: new Date().toLocaleDateString("he-IL"),
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
          orderFormLink: `${ORDER_FORM_URL}/`,
          termsLink: TERMS_URL,
          todayDate: new Date().toLocaleDateString("he-IL"),
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
