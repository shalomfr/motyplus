import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, replaceTemplateVariables } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";
import { listFiles, shareFile } from "@/lib/file-storage";
import { logActivity } from "@/lib/activity-logger";

export const dynamic = "force-dynamic";

interface SendableCustomer {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  whatsappPhone: string | null;
  currentUpdateVersion: string | null;
  amountPaid: number;
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
  updateVersion: { id: string; version: string; emailSubject: string | null; emailBody: string | null; rhythmsFileUrl: string | null },
  cpiMap: Map<number, { main?: string; additional?: string }>,
  userId: string
): Promise<{ sent: number; skippedNoFile: number; failed: number }> {
  const results = { sent: 0, skippedNoFile: 0, failed: 0 };

  for (const customer of customers) {
    const cpiFiles = cpiMap.get(customer.id);
    if (!cpiFiles?.main) { results.skippedNoFile++; continue; }

    try {
      let downloadLink = "";
      let downloadLink2 = "";

      try { downloadLink = await shareFile(cpiFiles.main, customer.email, "reader"); }
      catch { results.failed++; continue; }

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

      if (updateVersion.emailSubject && updateVersion.emailBody) {
        const additionalOrganName = customer.additionalOrgan?.name || "";
        const additionalOrganLine = additionalOrganName && downloadLink2
          ? `<p>בנוסף, העדכון כולל גם קבצים עבור ה-${additionalOrganName} שלך.</p>` : "";

        const vars = {
          customerName: customer.fullName, version: updateVersion.version,
          updateVersion: updateVersion.version, organName: customer.organ.name,
          additionalOrganName, additionalOrganLine,
          setType: customer.setType.name, downloadLink, downloadLink2,
          rhythmsLink: updateVersion.rhythmsFileUrl || "",
        };
        const html = replaceTemplateVariables(updateVersion.emailBody, vars);
        const subject = replaceTemplateVariables(updateVersion.emailSubject, vars);
        try { await sendEmail({ to: customer.email, subject, html }); } catch { /* logged below */ }
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
    } catch {
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

  for (const customer of customers) {
    const remainingForFullSet = fullSetPrice
      ? Math.max(0, Number(fullSetPrice.price) - Number(customer.amountPaid)) : 0;

    const vars = {
      fullName: customer.fullName, firstName: customer.fullName.split(" ")[0],
      organ: customer.organ.name, setType: customer.setType.name,
      currentVersion: customer.currentUpdateVersion || "—",
      remainingAmount: String(remainingForFullSet),
      remainingForFullSet: `₪${remainingForFullSet}`,
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

      results.eligible = await sendToEligible(
        customers as unknown as SendableCustomer[],
        updateVersion,
        cpiMap,
        session.user.id
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
          setType: { includesUpdates: true },
          isCasual: false,
          OR: [
            { currentUpdateVersion: null },
            latestVersion ? { currentUpdateVersion: { not: latestVersion.version } } : {},
          ],
        },
        include: customerInclude,
      });

      results.not_updated = await sendBulkTemplate(
        customers as unknown as SendableCustomer[],
        "הצעת מחיר — למי שלא מעודכן",
        session.user.id
      );
    }

    if (segments.includes("half_set")) {
      const customers = await prisma.customer.findMany({
        where: {
          status: "ACTIVE",
          setType: { includesUpdates: false },
          isCasual: false,
        },
        include: customerInclude,
      });

      results.half_set = await sendBulkTemplate(
        customers as unknown as SendableCustomer[],
        "הצעה לחצאי סטים",
        session.user.id
      );
    }

    if (segments.includes("expired")) {
      const customers = await prisma.customer.findMany({
        where: {
          status: "ACTIVE",
          isCasual: false,
          organ: { supportsUpdates: true },
          setType: { includesUpdates: true },
          updateExpiryDate: { lt: now },
        },
        include: customerInclude,
      });

      results.expired = await sendBulkTemplate(
        customers as unknown as SendableCustomer[],
        "הצעת מחיר — למי שלא מעודכן",
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
