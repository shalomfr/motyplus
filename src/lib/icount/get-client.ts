import { prisma } from "@/lib/prisma";
import { createICountClient } from "./client";
import { decrypt } from "@/lib/crypto";
import type { ICountSettings } from "./types";
import type { BillingProvider } from "@prisma/client";

interface ICountClientResult {
  client: ReturnType<typeof createICountClient>;
  provider: BillingProvider;
}

/**
 * Gets the primary iCount client configured in the system.
 * This is used in most places where iCount integration is needed.
 */
export async function getICountClient(): Promise<ICountClientResult | null> {
  const provider = await prisma.billingProvider.findFirst({
    where: { provider: "ICOUNT", isActive: true, isPrimary: true },
  });
  if (!provider) return null;

  const companyId = decrypt(provider.apiKey);
  const credentials = provider.apiSecret ? decrypt(provider.apiSecret) : "";
  const settings = (provider.settings as ICountSettings) || {};

  return { client: createICountClient(companyId, credentials, settings), provider };
}

/**
 * Gets a specific iCount provider by ID.
 * Used in cases where you need to test or access a non-primary provider.
 */
export async function getICountClientById(providerId: string): Promise<ICountClientResult | null> {
  const provider = await prisma.billingProvider.findUnique({
    where: { id: providerId },
  });
  if (!provider) return null;

  const companyId = decrypt(provider.apiKey);
  const credentials = provider.apiSecret ? decrypt(provider.apiSecret) : "";
  const settings = (provider.settings as ICountSettings) || {};

  return { client: createICountClient(companyId, credentials, settings), provider };
}
