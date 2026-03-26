import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // כל 200 הלקוחות הפייק (customerId 60000-60199)
  const customers = await prisma.customer.findMany({
    where: {
      customerId: {
        in: Array.from({ length: 200 }, (_, i) => (60000 + i).toString()),
      },
    },
    select: {
      id: true,
      customerId: true,
      additionalOrganId: true,
    },
  });

  console.log(`Found ${customers.length} fake customers to update`);

  let updated = 0;
  for (const customer of customers) {
    const data: { infoFileUrl: string; additionalInfoFileUrl?: string } = {
      infoFileUrl: `customers/info/${customer.customerId}.n27`,
    };

    // אם יש אורגן נוסף — קובץ אינפו נוסף
    if (customer.additionalOrganId) {
      data.additionalInfoFileUrl = `customers/info/${customer.customerId}_2.n27`;
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data,
    });

    updated++;
    if (updated % 50 === 0) {
      console.log(`Updated ${updated}/${customers.length}...`);
    }
  }

  console.log(`Done! Updated ${updated} customers with info file URLs.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
