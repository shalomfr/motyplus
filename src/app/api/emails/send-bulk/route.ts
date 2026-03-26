import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail, replaceTemplateVariables } from "@/lib/email";
import { logActivity } from "@/lib/activity-logger";
import { getBillingClient } from "@/lib/billing";

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// GET /api/emails/send-bulk — סטטיסטיקות: כמה לקוחות בכל קבוצה
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const latestVersion = await prisma.updateVersion.findFirst({
      where: { status: { not: "DRAFT" } },
      orderBy: { sortOrder: "desc" },
    });

    const [notUpdatedCount, halfSetCount] = await Promise.all([
      prisma.customer.count({
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
      }),
      prisma.customer.count({
        where: {
          status: { in: ["ACTIVE"] },
          setType: { includesUpdates: false },
          isCasual: false,
        },
      }),
    ]);

    return NextResponse.json({
      notUpdatedCount,
      halfSetCount,
      latestVersion: latestVersion?.version || null,
    });
  } catch (error) {
    console.error("Error fetching bulk stats:", error);
    return NextResponse.json({ error: "שגיאה בטעינת נתונים" }, { status: 500 });
  }
}

// POST /api/emails/send-bulk — שליחה קבוצתית: למי שלא מעודכן / חצאי סטים
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      notUpdatedTemplateId,
      halfSetTemplateId,
    } = body as {
      type: "not_updated" | "half_set" | "both";
      notUpdatedTemplateId?: string;
      halfSetTemplateId?: string;
    };

    if (!type || !["not_updated", "half_set", "both"].includes(type)) {
      return NextResponse.json({ error: "סוג שליחה לא תקין" }, { status: 400 });
    }

    const latestVersion = await prisma.updateVersion.findFirst({
      where: { status: { not: "DRAFT" } },
      orderBy: { sortOrder: "desc" },
    });

    const billing = await getBillingClient();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.AUTH_URL || "";

    // Full set price for balance calculations
    const fullSetPrice = await prisma.setType.findFirst({
      where: { includesUpdates: true },
      select: { price: true },
    });

    let totalSent = 0;
    let totalFailed = 0;

    // Helper: find template by id or name
    async function findTemplate(templateId?: string, fallbackName?: string) {
      if (templateId) {
        const t = await prisma.emailTemplate.findUnique({
          where: { id: templateId },
        });
        if (t) return t;
      }
      if (fallbackName) {
        return prisma.emailTemplate.findFirst({
          where: { name: fallbackName },
        });
      }
      return null;
    }

    // Send to not_updated customers
    if (type === "not_updated" || type === "both") {
      const template = await findTemplate(
        notUpdatedTemplateId,
        "הצעת מחיר — למי שלא מעודכן"
      );

      if (!template) {
        return NextResponse.json({
          error: "לא נמצאה תבנית למי שלא מעודכן",
        }, { status: 400 });
      }

      const customers = await prisma.customer.findMany({
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

      const notUpdatedChunks = chunkArray(customers, 10);
      for (const chunk of notUpdatedChunks) {
        await Promise.all(
          chunk.map(async (customer) => {
            const remainingForFullSet = fullSetPrice
              ? Math.max(0, Number(fullSetPrice.price) - Number(customer.amountPaid))
              : 0;

            // Create payment link if billing is available and there's a balance
            let paymentLink = "";
            if (billing && remainingForFullSet > 0) {
              try {
                const page = await billing.client.createPaymentPage({
                  customer: { name: customer.fullName, email: customer.email, phone: customer.phone },
                  items: [{ description: "עדכון תוכנה", quantity: 1, unitPrice: remainingForFullSet }],
                  successUrl: `${baseUrl}/order/success`,
                  cancelUrl: `${baseUrl}/order/cancel`,
                  autoCreateDoc: true,
                  docType: "invoice_receipt",
                  metadata: { customerId: String(customer.id), source: "bulk_quote" },
                });
                paymentLink = page.url;
              } catch { /* continue without link */ }
            }

            const variables = {
              fullName: customer.fullName,
              firstName: customer.fullName.split(" ")[0],
              organ: customer.organ.name,
              setType: customer.setType.name,
              currentVersion: customer.currentUpdateVersion || "—",
              updateVersion: latestVersion?.version || "—",
              remainingAmount: String(remainingForFullSet),
              remainingForFullSet: `₪${remainingForFullSet.toLocaleString("he-IL")}`,
              paymentLink,
              driveLink: "",
              youtubeLink: "",
              customLink: "",
              orderFormLink: "https://motyplus-order.onrender.com/",
              termsLink: "https://motyplus-order.onrender.com/terms",
              todayDate: new Date().toLocaleDateString("he-IL"),
            };

            const html = replaceTemplateVariables(template.body, variables);
            const subject = replaceTemplateVariables(template.subject, variables);

            try {
              const result = await sendEmail({ to: customer.email, subject, html });
              if (result.success) {
                totalSent++;
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
                totalFailed++;
                await prisma.emailLog.create({
                  data: {
                    customerId: customer.id,
                    toEmail: customer.email,
                    subject: subject,
                    status: "FAILED",
                    templateId: template.id,
                    userId: session.user.id,
                  },
                });
              }
            } catch {
              totalFailed++;
              await prisma.emailLog.create({
                data: {
                  customerId: customer.id,
                  toEmail: customer.email,
                  subject: subject,
                  status: "FAILED",
                  templateId: template.id,
                  userId: session.user.id,
                },
              });
            }
          })
        );
      }
    }

    // Send to half_set customers
    if (type === "half_set" || type === "both") {
      const template = await findTemplate(
        halfSetTemplateId,
        "הצעה לחצאי סטים"
      );

      if (!template) {
        return NextResponse.json({
          error: "לא נמצאה תבנית לחצאי סטים",
        }, { status: 400 });
      }

      const customers = await prisma.customer.findMany({
        where: {
          status: { in: ["ACTIVE"] },
          setType: { includesUpdates: false },
          isCasual: false,
        },
        include: { organ: true, setType: true },
      });

      const halfSetChunks = chunkArray(customers, 10);
      for (const chunk of halfSetChunks) {
        await Promise.all(
          chunk.map(async (customer) => {
            const remainingForFullSet = fullSetPrice
              ? Math.max(0, Number(fullSetPrice.price) - Number(customer.amountPaid))
              : 0;

            let paymentLink = "";
            if (billing && remainingForFullSet > 0) {
              try {
                const page = await billing.client.createPaymentPage({
                  customer: { name: customer.fullName, email: customer.email, phone: customer.phone },
                  items: [{ description: "שדרוג לסט שלם", quantity: 1, unitPrice: remainingForFullSet }],
                  successUrl: `${baseUrl}/order/success`,
                  cancelUrl: `${baseUrl}/order/cancel`,
                  autoCreateDoc: true,
                  docType: "invoice_receipt",
                  metadata: { customerId: String(customer.id), source: "bulk_quote_half" },
                });
                paymentLink = page.url;
              } catch { /* continue without link */ }
            }

            const variables = {
              fullName: customer.fullName,
              firstName: customer.fullName.split(" ")[0],
              organ: customer.organ.name,
              setType: customer.setType.name,
              currentVersion: customer.currentUpdateVersion || "—",
              updateVersion: latestVersion?.version || "—",
              remainingAmount: String(remainingForFullSet),
              remainingForFullSet: `₪${remainingForFullSet.toLocaleString("he-IL")}`,
              paymentLink,
              driveLink: "",
              youtubeLink: "",
              customLink: "",
              orderFormLink: "https://motyplus-order.onrender.com/",
              termsLink: "https://motyplus-order.onrender.com/terms",
              todayDate: new Date().toLocaleDateString("he-IL"),
            };

            const html = replaceTemplateVariables(template.body, variables);
            const subject = replaceTemplateVariables(template.subject, variables);

            try {
              const result = await sendEmail({ to: customer.email, subject, html });
              if (result.success) {
                totalSent++;
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
                totalFailed++;
                await prisma.emailLog.create({
                  data: {
                    customerId: customer.id,
                    toEmail: customer.email,
                    subject: subject,
                    status: "FAILED",
                    templateId: template.id,
                    userId: session.user.id,
                  },
                });
              }
            } catch {
              totalFailed++;
              await prisma.emailLog.create({
                data: {
                  customerId: customer.id,
                  toEmail: customer.email,
                  subject: subject,
                  status: "FAILED",
                  templateId: template.id,
                  userId: session.user.id,
                },
              });
            }
          })
        );
      }
    }

    await logActivity({
      userId: session.user.id,
      action: type === "both" ? "BULK_EMAIL_QUOTES" : type === "not_updated" ? "BULK_EMAIL_NOT_UPDATED" : "BULK_EMAIL_HALF_SET",
      entityType: "EMAIL",
      entityId: "bulk",
      details: { type, sent: totalSent, failed: totalFailed },
    });

    return NextResponse.json({
      sent: totalSent,
      failed: totalFailed,
      message: `נשלחו ${totalSent} מיילים בהצלחה${totalFailed > 0 ? `, ${totalFailed} נכשלו` : ""}`,
    });
  } catch (error) {
    console.error("Error sending bulk emails:", error);
    return NextResponse.json({ error: "שגיאה בשליחה קבוצתית" }, { status: 500 });
  }
}
