import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getBillingClient } from "@/lib/billing";
import { getCustomerBalanceDetails } from "@/lib/services/customer-balance.service";
import { sendEmail, replaceTemplateVariables } from "@/lib/email";
import { logActivity } from "@/lib/activity-logger";

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
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "מזהה לקוח לא תקין" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { templateId, paymentUrl: existingPaymentUrl } = body as {
      templateId?: string;
      paymentUrl?: string;
    };

    const [customer, details] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          fullName: true, email: true, phone: true,
          currentUpdateVersion: true,
          organ: { select: { name: true } },
          setType: { select: { name: true } },
        },
      }),
      getCustomerBalanceDetails(customerId),
    ]);

    if (!customer || !details) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }

    if (details.totalOwed <= 0) {
      return NextResponse.json({ error: "אין יתרה לתשלום" }, { status: 400 });
    }

    // Use chosen template or fallback to auto-find
    let template: { id: string; name: string; subject: string; body: string } | null = null;
    if (templateId) {
      template = await prisma.emailTemplate.findUnique({
        where: { id: templateId },
        select: { id: true, name: true, subject: true, body: true },
      });
    }
    if (!template) {
      template = await findQuoteTemplate();
    }
    if (!template) {
      return NextResponse.json({ error: "לא נמצאה תבנית הצעת מחיר" }, { status: 404 });
    }

    // Use existing payment URL or create new one
    let paymentLink = existingPaymentUrl;
    if (!paymentLink) {
      const billing = await getBillingClient();
      if (!billing) {
        return NextResponse.json({ error: "לא הוגדר ספק חיוב" }, { status: 503 });
      }

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.AUTH_URL || "";
      const page = await billing.client.createPaymentPage({
        customer: { name: customer.fullName, email: customer.email, phone: customer.phone },
        items: [{ description: details.description, quantity: 1, unitPrice: details.totalOwed }],
        successUrl: `${baseUrl}/order/success`,
        cancelUrl: `${baseUrl}/order/cancel`,
        autoCreateDoc: true,
        docType: "invoice_receipt",
        metadata: { customerId: String(customerId), source: "price_quote" },
      });
      paymentLink = page.url;
    }

    const vars: Record<string, string> = {
      fullName: customer.fullName,
      firstName: customer.fullName.split(" ")[0],
      organ: customer.organ.name,
      setType: customer.setType.name,
      currentVersion: customer.currentUpdateVersion || "—",
      remainingAmount: String(details.totalOwed),
      remainingForFullSet: `₪${details.totalOwed.toLocaleString("he-IL")}`,
      paymentLink,
    };

    const html = replaceTemplateVariables(template.body, vars);
    const subject = replaceTemplateVariables(template.subject, vars);

    const result = await sendEmail({ to: customer.email, subject, html });

    if (result.success) {
      await prisma.emailLog.create({
        data: {
          customerId,
          templateId: template.id,
          toEmail: customer.email,
          subject,
          body: html,
          status: "SENT",
          sentAt: new Date(),
          userId: session.user.id,
        },
      });

      await logActivity({
        userId: session.user.id,
        customerId,
        action: "SEND_EMAIL",
        entityType: "CUSTOMER",
        entityId: String(customerId),
        details: { type: "price_quote", amount: details.totalOwed, templateName: template.name },
      });
    }

    return NextResponse.json({
      success: result.success,
      paymentUrl: paymentLink,
      amount: details.totalOwed,
    });
  } catch (error) {
    console.error("Error sending price quote:", error);
    return NextResponse.json({ error: "שגיאה בשליחת הצעת מחיר" }, { status: 500 });
  }
}

async function findQuoteTemplate() {
  const byCategory = await prisma.emailTemplate.findFirst({
    where: { category: "price_quote", isActive: true },
    select: { id: true, name: true, subject: true, body: true },
  });
  if (byCategory) return byCategory;

  return prisma.emailTemplate.findFirst({
    where: {
      OR: [
        { name: { contains: "הצעת מחיר", mode: "insensitive" } },
        { name: { contains: "price quote", mode: "insensitive" } },
      ],
      isActive: true,
    },
    select: { id: true, name: true, subject: true, body: true },
  });
}
