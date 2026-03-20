import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const customers = await prisma.customer.findMany({ orderBy: { id: "asc" } });

  const dates2026 = [
    new Date(2026, 0, 10),   // Jan 2026
    new Date(2026, 0, 25),   // Jan 2026
    new Date(2026, 1, 5),    // Feb 2026
    new Date(2026, 1, 14),   // Feb 2026
    new Date(2026, 1, 20),   // Feb 2026
    new Date(2026, 2, 1),    // Mar 2026
    new Date(2026, 2, 8),    // Mar 2026
    new Date(2026, 2, 12),   // Mar 2026
    new Date(2026, 0, 3),    // Jan 2026
    new Date(2026, 0, 18),   // Jan 2026
    new Date(2026, 1, 2),    // Feb 2026
    new Date(2026, 1, 9),    // Feb 2026
    new Date(2026, 1, 28),   // Feb 2026
    new Date(2026, 2, 5),    // Mar 2026
    new Date(2026, 2, 10),   // Mar 2026
    new Date(2026, 2, 15),   // Mar 2026
  ];

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const date = dates2026[i];
    const expiry = new Date(date);
    expiry.setFullYear(expiry.getFullYear() + 1);

    await prisma.customer.update({
      where: { id: c.id },
      data: { purchaseDate: date, updateExpiryDate: expiry },
    });

    console.log(`${c.id} ${c.fullName.padEnd(14)} ${date.toISOString().slice(0, 10)}`);
  }

  console.log(`\n✓ ${customers.length} לקוחות עודכנו ל-2026`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
