import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, replaceTemplateVariables } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";
import { listFiles, shareFile, getShareableLink } from "@/lib/file-storage";
import { logActivity } from "@/lib/activity-logger";
import { getBillingClient } from "@/lib/billing";

export const dynamic = "force-dynamic";

interface SendableCustomer {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  whatsappPhone: string | null;
  currentUpdateVersion: string | null;
  amountPaid: number;
  organId: string;
  setTypeId: string;
  organ: { name: string };
  additionalOrgan: { name: string } | null;
  setType: { name: string; includesUpdates: boolean; price?: number };
}

function buildCpiMap(sampleFiles: { path: string }[]): Map<number, { main?: string; additional?: string }> {
  const map = new Map<number, { main?: string; additional?: string }>();
  for (const f of sampleFiles) {
    const name = f.path.split("/").pop() || "";
    const baseName = name.replace(/\.cpi$/i, "");
    const isAdditional = baseName.includes("_");
    const custId = parseInt(isAdditional ? baseName.split("_")[0] : baseName);
    if (isNaN(custId)) continue;
    if (!map.has(custId)) map.set(custId, {});
    const entry = map.get(custId)!;
    if (isAdditional) entry.additional = f.path;
    else entry.main = f.path;
  }
  return map;
}

async function sendToEligible(
  customers: SendableCustomer[],
  updateVersion: { id: string; version: string; emailSubject: string | null; emailBody: string | null; emailTemplateMap: unknown; rhythmsFileUrl: string | null; releaseDate: Date | null },
  cpiMap: Map<number, { main?: string; additional?: string }>,
  userId: string,
  rhythmsLinkMap: Map<string, string>
): Promise<{ sent: number; skippedNoFile: number; failed: number; emailSent: number; emailSkipped: number }> {
  const results = { sent: 0, skippedNoFile: 0, failed: 0, emailSent: 0, emailSkipped: 0 };

  // Pre-load fallback template from DB in case emailTemplateMap is missing/empty
  const tMap = updateVersion.emailTemplateMap as Record<string, Record<string, { templateName?: string; subject?: string; body?: string }>> | null;
  let fallbackTemplate: { subject: string; body: string } | null = null;
  if (!updateVersion.emailSubject || !updateVersion.emailBody) {
    // Try to find a default template by name from the eligible map or a known default
    const defaultNames = ["שליחת עדכון", "עדכון — Genos / PSR-SX920", "עדכון חדש — ללקוח מעודכן"];
    for (const name of defaultNames) {
      const tpl = await prisma.emailTemplate.findFirst({ where: { name, isActive: true } });
      if (tpl) {
        fallbackTemplate = { subject: tpl.subject, body: tpl.body };
        break;
      }
    }
  }

  for (const customer of customers) {
    const cpiFiles = cpiMap.get(customer.id);
    if (!cpiFiles?.main) { results.skippedNoFile++; continue; }

    try {
      let downloadLink = "";
      let downloadLink2 = "";

      try { downloadLink = await shareFile(cpiFiles.main, customer.email, "reader"); }
      catch (err) {
        console.error(`Failed to share CPI for customer ${customer.id}:`, err);
        results.failed++; continue;
      }

      if (cpiFiles.additional) {
        try { downloadLink2 = await shareFile(cpiFiles.additional, customer.email, "reader"); }
        catch { /* non-critical */ }
      }

      await prisma.customerUpdate.upsert({
        where: { customerId_updateVersionId: { customerId: customer.id, updateVersionId: updateVersion.id } },
        create: { customerId: customer.id, updateVersionId: updateVersion.id, sentAt: new Date(), sentById: userId },
        update: { sentAt: new Date(), sentById: userId },
      });

      await prisma.customer.update({
        where: { id: customer.id },
        data: { currentUpdateVersion: updateVersion.version },
      });

      // Look up per-organ template from emailTemplateMap, fallback to updateVersion fields, then DB template
      const organTemplate = tMap?.eligible?.[customer.organId];
      let emailSubject = organTemplate?.subject || updateVersion.emailSubject;
      let emailBody = organTemplate?.body || updateVersion.emailBody;

      // If still no template, try loading from DB by templateName in the map
      if (!emailSubject || !emailBody) {
        if (organTemplate?.templateName) {
          const dbTpl = await prisma.emailTemplate.findFirst({ where: { name: organTemplate.templateName, isActive: true } });
          if (dbTpl) {
            emailSubject = emailSubject || dbTpl.subject;
            emailBody = emailBody || dbTpl.body;
          }
        }
      }

      // Last resort: use pre-loaded fallback template
      if (!emailSubject || !emailBody) {
        if (fallbackTemplate) {
          emailSubject = emailSubject || fallbackTemplate.subject;
          emailBody = emailBody || fallbackTemplate.body;
        }
      }

      if (emailSubject && emailBody) {
        const additionalOrganName = customer.additionalOrgan?.name || "";
        const additionalOrganLine = additionalOrganName && downloadLink2
          ? `<p>בנוסף, העדכון כולל גם קבצים עבור ה-${additionalOrganName} שלך.</p>` : "";

        const vars = {
          customerName: customer.fullName, fullName: customer.fullName,
          firstName: customer.fullName.split(" ")[0],
          version: updateVersion.version,
          updateVersion: updateVersion.version, organName: customer.organ.name,
          organ: customer.organ.name,
          additionalOrganName, additionalOrganLine,
          setType: customer.setType.name,
          samplesLink: downloadLink, rhythmsLink: rhythmsLinkMap.get(`${customer.organId}_${customer.setTypeId}`) || updateVersion.rhythmsFileUrl || "",
          releaseDate: new Date(updateVersion.releaseDate || Date.now()).toLocaleDateString("he-IL"),
          downloadLink, downloadLink2,
          customLink: "",
          orderFormLink: "https://motyplus-order.onrender.com/",
          termsLink: "https://motyplus-order.onrender.com/terms",
          todayDate: new Date().toLocaleDateString("he-IL"),
        };
        const html = replaceTemplateVariables(emailBody, vars);
        const subject = replaceTemplateVariables(emailSubject, vars);
        try {
          const emailResult = await sendEmail({ to: customer.email, subject, html });
          if (emailResult.success) {
            results.emailSent++;
          } else {
            console.error(`Email send failed for customer ${customer.id}:`, emailResult.error);
          }
        } catch (err) {
          console.error(`Email send error for customer ${customer.id}:`, err);
        }
      } else {
        console.warn(`No email template found for customer ${customer.id} (organ: ${customer.organId}). emailSubject: ${!!emailSubject}, emailBody: ${!!emailBody}`);
        results.emailSkipped++;
      }

      const phone = customer.whatsappPhone || customer.phone;
      if (phone) {
        let waMsg = `שלום ${customer.fullName}!\nעדכון *${updateVersion.version}* מוכן עבורך`;
        if (downloadLink) waMsg += `\n\nלינק להורדה:\n${downloadLink}`;
        if (downloadLink2) waMsg += `\n\nלינק נוסף (אורגן נוסף):\n${downloadLink2}`;
        try { await sendWhatsApp({ phone, message: waMsg }); } catch { /* non-critical */ }
      }

      await logActivity({
        userId, customerId: customer.id, action: "SEND_UPDATE",
        entityType: "CUSTOMER_UPDATE", entityId: updateVersion.id,
        details: { version: updateVersion.version, customerId: customer.id, downloadLink, wizard: true },
      });

      results.sent++;
    } catch (err) {
      console.error(`Failed to process eligible customer ${customer.id}:`, err);
      results.failed++;
    }
  }

  return results;
}

async function sendBulkTemplate(
  customers: SendableCustomer[],
  templateName: string,
  userId: string
): Promise<{ sent: number; failed: number }> {
  const template = await prisma.emailTemplate.findFirst({ where: { name: templateName } });
  if (!template) return { sent: 0, failed: 0 };

  const fullSetPrice = await prisma.setType.findFirst({
    where: { includesUpdates: true },
    select: { price: true },
  });

  let sent = 0;
  let failed = 0;

  const billing = await getBillingClient();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.AUTH_URL || "";
  const needsPaymentLink = template.body.includes("{{paymentLink}}") || template.subject.includes("{{paymentLink}}");

  for (const customer of customers) {
    const remainingForFullSet = fullSetPrice
      ? Math.max(0, Number(fullSetPrice.price) - Number(customer.amountPaid)) : 0;

    let paymentLink = "";
    if (needsPaymentLink && billing && remainingForFullSet > 0) {
      try {
        const page = await billing.client.createPaymentPage({
          customer: { name: customer.fullName, email: customer.email, phone: customer.phone },
          items: [{ description: `השלמת תשלום — ${customer.setType.name}`, quantity: 1, unitPrice: remainingForFullSet }],
          successUrl: `${baseUrl}/order/success`,
          cancelUrl: `${baseUrl}/order/cancel`,
          autoCreateDoc: true,
          docType: "invoice_receipt",
          metadata: { customerId: String(customer.id), source: "email_bulk" },
        });
        paymentLink = page.url;
      } catch (err) {
        console.error(`Failed to create payment link for customer ${customer.id}:`, err);
      }
    }

    const vars = {
      fullName: customer.fullName, firstName: customer.fullName.split(" ")[0],
      organ: customer.organ.name, setType: customer.setType.name,
      currentVersion: customer.currentUpdateVersion || "—",
      remainingAmount: String(remainingForFullSet),
      remainingForFullSet: `₪${remainingForFullSet}`,
      paymentLink,
      orderFormLink: "https://motyplus-order.onrender.com/",
      termsLink: "https://motyplus-order.onrender.com/terms",
      todayDate: new Date().toLocaleDateString("he-IL"),
    };

    const html = replaceTemplateVariables(template.body, vars);
    const subject = replaceTemplateVariables(template.subject, vars);

    try {
      const result = await sendEmail({ to: customer.email, subject, html });
      if (result.success) {
        sent++;
        await prisma.emailLog.create({
          data: {
            customerId: customer.id, templateId: template.id,
            toEmail: customer.email, subject, body: html,
            status: "SENT", sentAt: new Date(), userId,
          },
        });
      } else { failed++; }
    } catch { failed++; }
  }

  return { sent, failed };
}

// POST /api/updates/[id]/wizard/send
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
    const body = await request.json();
    const { segments } = body as { segments: string[] };

    if (!segments || segments.length === 0) {
      return NextResponse.json({ error: "לא נבחרו סגמנטים" }, { status: 400 });
    }

    const updateVersion = await prisma.updateVersion.findUnique({ where: { id } });
    if (!updateVersion) {
      return NextResponse.json({ error: "העדכון לא נמצא" }, { status: 404 });
    }

    const now = new Date();
    const alreadyReceived = await prisma.customerUpdate.findMany({
      where: { updateVersionId: id },
      select: { customerId: true },
    });
    const alreadyReceivedIds = new Set(alreadyReceived.map((cu) => cu.customerId));

    const customerInclude = {
      organ: { select: { name: true, supportsUpdates: true } },
      additionalOrgan: { select: { name: true } },
      setType: { select: { name: true, includesUpdates: true } },
    } as const;

    let sampleFiles: { path: string }[] = [];
    if (segments.includes("eligible")) {
      try { sampleFiles = await listFiles("updates/samples"); } catch { /* ok */ }
    }
    const cpiMap = buildCpiMap(sampleFiles);

    // בניית מפה: organId_setTypeId → קישור מקצבים (אוטומטי מתיקיות דרייב)
    const [allOrgans, allSetTypes] = await Promise.all([
      prisma.organ.findMany({ select: { id: true, demoAlias: true } }),
      prisma.setType.findMany({ select: { id: true, demoAlias: true } }),
    ]);
    const organAliasMap = new Map(allOrgans.map(o => [o.id, o.demoAlias]));
    const setTypeAliasMap = new Map(allSetTypes.map(st => [st.id, st.demoAlias]));

    const rhythmsLinkMap = new Map<string, string>();

    const results: Record<string, { sent: number; failed: number; skippedNoFile?: number }> = {};

    if (segments.includes("eligible")) {
      const customers = await prisma.customer.findMany({
        where: {
          id: { notIn: [...alreadyReceivedIds].length > 0 ? [...alreadyReceivedIds] : [-1] },
          status: { in: ["ACTIVE", "EXCEPTION"] },
          isCasual: false,
          organ: { supportsUpdates: true },
          setType: { includesUpdates: true },
          OR: [{ updateExpiryDate: { gte: now } }, { status: "EXCEPTION" }],
        },
        include: customerInclude,
      });

      // בניית קישורי מקצבים מתיקיות דרייב
      const uniqueCombos = new Set(customers.map(c => `${c.organId}_${c.setTypeId}`));
      for (const combo of uniqueCombos) {
        if (rhythmsLinkMap.has(combo)) continue;
        const [orgId, stId] = combo.split("_");
        const organAlias = organAliasMap.get(orgId);
        const setTypeAlias = setTypeAliasMap.get(stId);
        if (!organAlias || !setTypeAlias) continue;
        const folderPath = `updates/beats/${organAlias}/${setTypeAlias}/${updateVersion.version} - ${organAlias}`;
        try {
          rhythmsLinkMap.set(combo, await getShareableLink(folderPath));
        } catch (err) {
          console.error(`Rhythms folder not found: ${folderPath}`, err);
        }
      }

      results.eligible = await sendToEligible(
        customers as unknown as SendableCustomer[],
        updateVersion,
        cpiMap,
        session.user.id,
        rhythmsLinkMap
      );
    }

    if (segments.includes("not_updated")) {
      const latestVersion = await prisma.updateVersion.findFirst({
        where: { status: { not: "DRAFT" } },
        orderBy: { sortOrder: "desc" },
      });

      const customers = await prisma.customer.findMany({
        where: {
          status: "ACTIVE",
          organ: { supportsUpdates: true },
          setType: { includesUpdates: true },
          isCasual: false,
          OR: [
            { currentUpdateVersion: null },
            latestVersion ? { currentUpdateVersion: { not: latestVersion.version } } : {},
          ],
        },
        include: customerInclude,
      });

      const notUpdatedTemplate = (updateVersion.emailTemplateMap as Record<string, { templateName?: string }> | null)?.not_updated;
      results.not_updated = await sendBulkTemplate(
        customers as unknown as SendableCustomer[],
        notUpdatedTemplate?.templateName || "הצעת מחיר — למי שלא מעודכן",
        session.user.id
      );
    }

    if (segments.includes("half_set")) {
      const customers = await prisma.customer.findMany({
        where: {
          status: "ACTIVE",
          organ: { supportsUpdates: true },
          setType: { includesUpdates: false },
          isCasual: false,
        },
        include: customerInclude,
      });

      const halfSetTemplate = (updateVersion.emailTemplateMap as Record<string, { templateName?: string }> | null)?.half_set;
      results.half_set = await sendBulkTemplate(
        customers as unknown as SendableCustomer[],
        halfSetTemplate?.templateName || "הצעה לחצאי סטים",
        session.user.id
      );
    }

    if (segments.includes("eligible") && results.eligible) {
      const totalEligible = (results.eligible.sent || 0) + (results.eligible.skippedNoFile || 0) + (results.eligible.failed || 0);
      const allSent = results.eligible.sent === totalEligible - (results.eligible.skippedNoFile || 0);
      if (results.eligible.sent > 0) {
        const newStatus = allSent ? "COMPLETED" : "SENDING";
        await prisma.updateVersion.update({
          where: { id },
          data: { status: newStatus },
        });
      }
    }

    await logActivity({
      userId: session.user.id,
      action: "WIZARD_SEND",
      entityType: "UpdateVersion",
      entityId: id,
      details: { segments, results },
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error in wizard send:", error);
    return NextResponse.json({ error: "שגיאה בשליחה מהאשף" }, { status: 500 });
  }
}
