import { prisma } from "@/lib/prisma";
import { getICountClient } from "@/lib/icount";
import { logActivity } from "@/lib/activity-logger";
import type { ICountPaymentType } from "@/lib/icount";

// Map payment method from payment model to iCount payment type
function mapPaymentMethodToICount(method: string | null): ICountPaymentType {
  const m = method?.toLowerCase() || "";
  if (m === "cash") return "cash";
  if (m === "check") return "check";
  if (m === "bank_transfer" || m === "transfer") return "bank_transfer";
  // Default: ICOUNT, STRIPE, MANUAL, credit_card
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

  const icount = await getICountClient();
  if (!icount) return null;

  try {
    // Map to the appropriate iCount method based on docType
    let result;
    const docRequest = {
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
      docType: docType as "receipt" | "tax_invoice" | "invoice_receipt",
      paymentType: mapPaymentMethodToICount(payment.paymentMethod),
      sendEmail: true,
    };

    if (docType === "receipt") {
      result = await icount.client.createReceipt(docRequest);
    } else if (docType === "tax_invoice") {
      result = await icount.client.createInvoice(docRequest);
    } else {
      // invoice_receipt (חשבונית מס-קבלה)
      result = await icount.client.createInvoiceReceipt(docRequest);
    }

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
      where: { id: icount.provider.id },
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
