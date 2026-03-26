import { prisma } from "@/lib/prisma";

export interface MissingUpdate {
  version: string;
  price: number;
}

export interface BalanceDetails {
  type: "fully_updated" | "missing_updates" | "half_set";
  totalOwed: number;
  missingUpdates: MissingUpdate[];
  currentVersion: string | null;
  latestVersion: string | null;
  setCompletionCost: number | null;
  amountPaid: number;
  setPrice: number;
  description: string;
  discountPercent: number | null;
  totalUpdates: number;
  completedUpdates: number;
}

export async function getCustomerBalanceDetails(
  customerId: number
): Promise<BalanceDetails | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { setType: true, promotion: true },
  });
  if (!customer) return null;

  const allUpdates = await prisma.updateVersion.findMany({
    where: { status: { not: "DRAFT" } },
    orderBy: { sortOrder: "asc" },
    select: { version: true, price: true },
  });

  const latestVersion = allUpdates.length > 0
    ? allUpdates[allUpdates.length - 1].version
    : null;

  const amountPaid = Number(customer.amountPaid);
  const setPrice = Number(customer.setType.price);
  const discountPercent = customer.promotion?.discountPercent || null;

  if (customer.setType.includesUpdates) {
    return buildFullSetBalance(customer, allUpdates, latestVersion, amountPaid, setPrice, discountPercent);
  }

  const halfSetMissing = findMissingUpdates(customer.currentUpdateVersion, allUpdates);
  return buildHalfSetBalance(customer, amountPaid, setPrice, latestVersion, discountPercent, allUpdates.length, allUpdates.length - halfSetMissing.length);
}

// ===== Helpers =====

function buildFullSetBalance(
  customer: { currentUpdateVersion: string | null; updateExpiryDate: Date; status: string; amountPaid: unknown },
  allUpdates: { version: string; price: unknown }[],
  latestVersion: string | null,
  amountPaid: number,
  setPrice: number,
  discountPercent: number | null,
): BalanceDetails {
  const isInPeriod = new Date() <= customer.updateExpiryDate;
  const isException = customer.status === "EXCEPTION";
  const totalUpdates = allUpdates.length;
  const completedUpdates = totalUpdates - findMissingUpdates(customer.currentUpdateVersion, allUpdates).length;

  if (isInPeriod || isException) {
    return {
      type: "fully_updated",
      totalOwed: 0,
      missingUpdates: [],
      currentVersion: customer.currentUpdateVersion,
      latestVersion,
      setCompletionCost: null,
      amountPaid,
      setPrice,
      description: "מעודכן — אין יתרה",
      discountPercent,
      totalUpdates,
      completedUpdates: totalUpdates,
    };
  }

  const missing = findMissingUpdates(customer.currentUpdateVersion, allUpdates);
  const totalOwed = missing.reduce((sum, u) => sum + u.price, 0);

  const versionList = missing.map((u) => u.version).join(" + ");
  const description = missing.length > 0
    ? `חסר ${missing.length} עדכונים: ${versionList}`
    : "מעודכן";

  return {
    type: missing.length > 0 ? "missing_updates" : "fully_updated",
    totalOwed,
    missingUpdates: missing,
    currentVersion: customer.currentUpdateVersion,
    latestVersion,
    setCompletionCost: null,
    amountPaid,
    setPrice,
    description,
    discountPercent,
    totalUpdates,
    completedUpdates: totalUpdates - missing.length,
  };
}

async function buildHalfSetBalance(
  customer: { currentUpdateVersion: string | null; amountPaid: unknown; promotionId?: string | null },
  amountPaid: number,
  setPrice: number,
  latestVersion: string | null,
  discountPercent: number | null,
  totalUpdates: number = 0,
  completedUpdates: number = 0,
): Promise<BalanceDetails> {
  const fullSet = await prisma.setType.findFirst({
    where: { includesUpdates: true },
    select: { price: true },
  });

  const fullSetPrice = fullSet ? Number(fullSet.price) : 0;

  // If customer paid with a discount, treat their amountPaid as the full set-type price
  // so the discount doesn't cause them to owe more for completion than other customers
  const effectiveAmountPaid = discountPercent && discountPercent > 0
    ? Math.max(amountPaid, setPrice)
    : amountPaid;

  const completionCost = Math.max(0, fullSetPrice - effectiveAmountPaid);

  return {
    type: "half_set",
    totalOwed: completionCost,
    missingUpdates: [],
    currentVersion: customer.currentUpdateVersion,
    latestVersion,
    setCompletionCost: completionCost,
    amountPaid,
    setPrice,
    description: completionCost > 0
      ? `השלמת סט שלם — חסר ₪${completionCost.toLocaleString("he-IL")}`
      : "שולם במלואו",
    discountPercent,
    totalUpdates,
    completedUpdates,
  };
}

function findMissingUpdates(
  currentVersion: string | null,
  allUpdates: { version: string; price: unknown }[],
): MissingUpdate[] {
  const missing: MissingUpdate[] = [];

  if (!currentVersion) {
    return allUpdates.map((u) => ({ version: u.version, price: Number(u.price) }));
  }

  let pastCurrent = false;
  for (const update of allUpdates) {
    if (update.version === currentVersion) {
      pastCurrent = true;
      continue;
    }
    if (pastCurrent) {
      missing.push({ version: update.version, price: Number(update.price) });
    }
  }

  return missing;
}
