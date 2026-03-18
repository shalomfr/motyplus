import { prisma } from "@/lib/prisma";
import { createICountClient } from "@/lib/icount";
import { decrypt } from "@/lib/crypto";
import { logActivity } from "@/lib/activity-logger";
import type { ICountSettings } from "@/lib/icount";

async function getICountClient() {
  const provider = await prisma.billingProvider.findFirst({
    where: { provider: "ICOUNT", isActive: true, isPrimary: true },
  });
  if (!provider) return null;

  const companyId = decrypt(provider.apiKey);
  const credentials = provider.apiSecret ? decrypt(provider.apiSecret) : "";
  const settings = (provider.settings as ICountSettings) || {};

  return { client: createICountClient(companyId, credentials, settings), provider };
}

export async function issueReceipt(
  paymentId: string,
  userId?: string
): Promise<{ receiptNumber: string; receiptUrl: string } | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { customer: true },
  });

  if (!payment || payment.hasReceipt) return null;

  const icount = await getICountClient();
  if (!icount) return null;

  try {
    const result = await icount.client.createReceipt({
      customer: {
        client_name: payment.customer.fullName,
        email: payment.customer.email,
        phone: payment.customer.phone,
      },
      items: [
        {
          description: payment.description || "תשלום",
          quantity: 1,
          unitprice: Number(payment.amount),
        },
      ],
      docType: "invoice_receipt",
      paymentType: (payment.paymentMethod?.toLowerCase() as "credit_card") || "credit_card",
      sendEmail: true,
    });

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        receiptNumber: result.number,
        receiptUrl: result.url,
        hasReceipt: true,
      },
    });

    await logActivity({
      userId: userId || undefined,
      customerId: payment.customerId,
      action: "הנפקת קבלה",
      entityType: "PAYMENT",
      entityId: paymentId,
      details: { receiptNumber: result.number, amount: Number(payment.amount) },
    });

    return { receiptNumber: result.number, receiptUrl: result.url };
  } catch (error) {
    console.error("Error issuing receipt:", error);

    // עדכון שגיאה בספק
    await prisma.billingProvider.update({
      where: { id: icount.provider.id },
      data: { lastError: error instanceof Error ? error.message : "שגיאה בהנפקת קבלה" },
    });

    return null;
  }
}

export async function syncCustomerToICount(customerId: number): Promise<string | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { organ: true },
  });

  if (!customer) return null;

  const icount = await getICountClient();
  if (!icount) return null;

  try {
    const clientId = await icount.client.createCustomer({
      client_name: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address || undefined,
    });

    return clientId;
  } catch (error) {
    console.error("Error syncing customer to iCount:", error);
    return null;
  }
}
