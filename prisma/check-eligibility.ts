import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function run() {
  const now = new Date();
  const ids = Array.from({ length: 200 }, (_, i) => (60000 + i).toString());

  const total = await p.customer.count({ where: { customerId: { in: ids } } });
  console.log("Total fake:", total);

  const notBlocked = await p.customer.count({
    where: { customerId: { in: ids }, status: { notIn: ["BLOCKED", "FROZEN"] } },
  });
  console.log("Not blocked/frozen:", notBlocked);

  const validExpiry = await p.customer.count({
    where: { customerId: { in: ids }, updateExpiryDate: { gte: now } },
  });
  console.log("Valid expiry:", validExpiry);

  const organs = await p.organ.findMany({ select: { id: true, name: true, supportsUpdates: true } });
  for (const o of organs) console.log("Organ:", o.name, "supportsUpdates:", o.supportsUpdates);

  const sets = await p.setType.findMany({ select: { id: true, name: true, includesUpdates: true, price: true } });
  for (const s of sets) console.log("SetType:", s.name, "includesUpdates:", s.includesUpdates);

  await p.$disconnect();
}
run();
