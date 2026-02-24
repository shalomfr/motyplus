import { prisma } from "./prisma";

interface CustomerForPricing {
  amountPaid: number;
  updateExpiryDate: Date;
  status: string;
  currentUpdateVersion: string | null;
  setType: {
    includesUpdates: boolean;
    price: number;
    name: string;
  };
}

/**
 * Calculate update eligibility
 */
export function isEligibleForUpdate(customer: CustomerForPricing): boolean {
  if (customer.status === "BLOCKED" || customer.status === "FROZEN") {
    return false;
  }
  if (customer.status === "EXCEPTION") {
    return true;
  }
  return new Date() <= customer.updateExpiryDate;
}

/**
 * Calculate balance owed by customer
 * - Full set + updated = 0
 * - Full set + past expiry = sum of missing update prices
 * - Non-full set = full set price - amount paid
 */
export async function calculateBalance(
  customer: CustomerForPricing
): Promise<number> {
  // Customer with full set that includes updates and is within period
  if (
    customer.setType.includesUpdates &&
    new Date() <= customer.updateExpiryDate
  ) {
    return 0;
  }

  // Customer with full set but past update period - owes for missing updates
  if (
    customer.setType.includesUpdates &&
    new Date() > customer.updateExpiryDate
  ) {
    const allUpdates = await prisma.updateVersion.findMany({
      orderBy: { sortOrder: "asc" },
    });

    // Find which updates the customer is missing
    const customerUpdates = customer.currentUpdateVersion;
    let totalOwed = 0;
    let pastCurrentVersion = false;

    for (const update of allUpdates) {
      if (update.version === customerUpdates) {
        pastCurrentVersion = true;
        continue;
      }
      if (pastCurrentVersion) {
        totalOwed += Number(update.price);
      }
    }

    return totalOwed;
  }

  // Customer without full set - balance for set completion
  const fullSetPrice = await prisma.setType.findFirst({
    where: { name: "סט שלם" },
  });

  if (!fullSetPrice) return 0;

  return Math.max(0, Number(fullSetPrice.price) - Number(customer.amountPaid));
}
