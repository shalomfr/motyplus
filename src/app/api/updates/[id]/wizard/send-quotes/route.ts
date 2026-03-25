import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, replaceTemplateVariables } from "@/lib/email";
import { logActivity } from "@/lib/activity-logger";

export const dynamic = "force-dynamic";

interface QuoteCustomerInput {
  id: number;
  paymentLink: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const { id: updateId } = await params;
    const body = await request.json();
    const { customers } = body as { customers: QuoteCustomerInput[] };

    if (!customers || customers.length === 0) {
      return NextResponse.json({ error: "לא התקבלו לקוחות" }, { status: 400 });
    }

    const updateVersion = await prisma.updateVersion.findUnique({
      where: { id: updateId },
      select: { emailTemplateMap: true, version: true },
    });

    const templateMap = updateVersion?.emailTemplateMap as Record<string, { templateName?: string }> | null;
    const quoteName = templateMap?.not_updated?.templateName || "הצעת מחיר — למי שלא מעודכן";

    const template = await prisma.emailTemplate.findFirst({
      where: { name: quoteName },
      select: { id: true, subject: true, body: true },
    });

    if (!template) {
      return NextResponse.json({ error: `תבנית "${quoteName}" לא נמצאה` }, { status: 404 });
    }

    let sent = 0;
    let failed = 0;

    for (const entry of customers) {
      const customer = await prisma.customer.findUnique({
        where: { id: entry.id },
        select: {
          fullName: true, email: true, phone: true,
          currentUpdateVersion: true, amountPaid: true,
          organ: { select: { name: true } },
          setType: { select: { name: true, price: true, includesUpdates: true } },
        },
      });

      if (!customer) { failed++; continue; }

      const remaining = Math.max(0, Number(customer.setType.price) - Number(customer.amountPaid));

      const vars: Record<string, string> = {
        fullName: customer.fullName,
        firstName: customer.fullName.split(" ")[0],
        organ: customer.organ.name,
        setType: customer.setType.name,
        currentVersion: customer.currentUpdateVersion || "—",
        updateVersion: updateVersion?.version || "",
        remainingAmount: String(remaining),
        remainingForFullSet: `₪${remaining.toLocaleString("he-IL")}`,
        paymentLink: entry.paymentLink || "",
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
              customerId: entry.id,
              templateId: template.id,
              toEmail: customer.email,
              subject,
              body: html,
              status: "SENT",
              sentAt: new Date(),
              userId: session.user.id,
            },
          });
        } else { failed++; }
      } catch { failed++; }
    }

    await logActivity({
      userId: session.user.id,
      action: "SEND_QUOTES",
      entityType: "UpdateVersion",
      entityId: updateId,
      details: { sent, failed, total: customers.length },
    });

    return NextResponse.json({ sent, failed });
  } catch (error) {
    console.error("Error sending quotes:", error);
    return NextResponse.json({ error: "שגיאה בשליחת הצעות מחיר" }, { status: 500 });
  }
}
