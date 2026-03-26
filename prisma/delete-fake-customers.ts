import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // מחיקת כל 200 הלקוחות הפייק (customerId 60000-60199)
  const customerIds = Array.from({ length: 200 }, (_, i) => (60000 + i).toString());

  const result = await prisma.customer.deleteMany({
    where: {
      customerId: {
        in: customerIds,
      },
    },
  });

  console.log(`Deleted ${result.count} fake customers.`);
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
