import { prisma } from "@/lib/prisma";
import { getBillingClient } from "@/lib/billing";
import type { PaymentType } from "@/lib/billing";
import { logActivity } from "@/lib/activity-logger";

// Map payment method from payment model to billing payment type
function mapPaymentMethod(method: string | null): PaymentType {
  const m = method?.toLowerCase() || "";
  if (m === "cash") return "cash";
  if (m === "check") return "check";
  if (m === "bank_transfer" || m === "transfer") return "bank_transfer";
  return "credit_card";
}

/**
 * Issue a receipt/invoice in iCount
 * Supports multiple document types (invoice_receipt, tax_invoice, receipt)
 * This is called when a payment is received (e.g., from iCount paypage webhook).
 */
export async function issueReceipt(
  paymentId: string,
  userId?: string,
  docType: "receipt" | "tax_invoice" | "invoice_receipt" = "invoice_receipt"
): Promise<{ receiptNumber: string; receiptUrl: string } | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { customer: true },
  });

  if (!payment || payment.hasReceipt) return null;

  const billing = await getBillingClient();
  if (!billing) return null;

  try {
    const result = await billing.client.createDocument({
      customer: {
        name: payment.customer.fullName,
        email: payment.customer.email,
        phone: payment.customer.phone,
        id: payment.customer.icountClientId || undefined,
      },
      items: [
        {
          description: payment.description || "תשלום",
          quantity: 1,
          unitPrice: Number(payment.amount),
        },
      ],
      docType,
      paymentType: mapPaymentMethod(payment.paymentMethod),
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
      details: {
        receiptNumber: result.number,
        amount: Number(payment.amount),
        docType,
      },
    });

    return { receiptNumber: result.number, receiptUrl: result.url };
  } catch (error) {
    console.error(`Error issuing ${docType}:`, error);

    // Update provider with error
    await prisma.billingProvider.update({
      where: { id: billing.provider.id },
      data: {
        lastError: error instanceof Error ? error.message : "שגיאה בהנפקת קבלה",
        lastSyncAt: new Date(),
      },
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

  // If already synced, return existing iCount client ID
  if (customer.icountClientId) return customer.icountClientId;

  const billing = await getBillingClient();
  if (!billing) return null;

  try {
    const clientId = await billing.client.createCustomer({
      name: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address || undefined,
    });

    // Save iCount client ID to prevent duplicates
    if (clientId) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { icountClientId: clientId },
      });
    }

    return clientId;
  } catch (error) {
    console.error("Error syncing customer to billing provider:", error);
    return null;
  }
}
