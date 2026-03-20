import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const customers = await prisma.customer.findMany({
    select: { id: true, fullName: true, purchaseDate: true, updateExpiryDate: true },
    orderBy: { id: "asc" },
  });

  console.log("ID     | שם             | תאריך קנייה | פג תוקף?");
  console.log("-------|----------------|-------------|--------");
  const eligible = [];
  for (const c of customers) {
    const recent = c.purchaseDate >= oneYearAgo;
    console.log(`${c.id} | ${c.fullName.padEnd(14)} | ${c.purchaseDate.toISOString().slice(0, 10)} | ${recent ? "✓ עדיין בתוקף" : "✗ עבר שנה"}`);
    if (recent) eligible.push(c);
  }
  console.log(`\n${eligible.length} לקוחות שעדיין לא עבר שנה מהקנייה`);
  console.log("IDs:", eligible.map(c => c.id).join(", "));
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
