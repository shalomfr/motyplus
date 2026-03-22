import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { createICountClient } from "@/lib/icount/client";
import type { ICountSettings } from "@/lib/icount/types";
import type { BillingProvider } from "@prisma/client";
import type { BillingClient } from "./client";
import { ICountAdapter } from "./icount-adapter";
import { YeshInvoiceClient } from "./yeshinvoice-client";
import { CardComClient } from "./cardcom-client";
import { GreenInvoiceClient } from "./greeninvoice-client";

export interface BillingClientResult {
  client: BillingClient;
  provider: BillingProvider;
}

/**
 * Gets the primary billing client (iCount or YeshInvoice).
 */
export async function getBillingClient(): Promise<BillingClientResult | null> {
  const provider = await prisma.billingProvider.findFirst({
    where: { isActive: true, isPrimary: true },
  });
  if (!provider) return null;
  return buildClient(provider);
}

/**
 * Gets a billing client by provider ID.
 */
export async function getBillingClientById(
  providerId: string
): Promise<BillingClientResult | null> {
  const provider = await prisma.billingProvider.findUnique({
    where: { id: providerId },
  });
  if (!provider) return null;
  return buildClient(provider);
}

function buildClient(provider: BillingProvider): BillingClientResult {
  if (provider.provider === "YESHINVOICE") {
    const authJson = decrypt(provider.apiKey);
    return { client: new YeshInvoiceClient(authJson), provider };
  }

  if (provider.provider === "CARDCOM") {
    const authJson = decrypt(provider.apiKey);
    return { client: new CardComClient(authJson), provider };
  }

  if (provider.provider === "GREEN_INVOICE") {
    const authJson = decrypt(provider.apiKey);
    return { client: new GreenInvoiceClient(authJson), provider };
  }

  // Default: ICOUNT
  const companyId = decrypt(provider.apiKey);
  const credentials = provider.apiSecret ? decrypt(provider.apiSecret) : "";
  const settings = (provider.settings as ICountSettings) || {};
  const icountClient = createICountClient(companyId, credentials, settings);
  return { client: new ICountAdapter(icountClient), provider };
}
