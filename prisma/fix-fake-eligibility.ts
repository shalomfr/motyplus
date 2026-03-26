import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function run() {
  const ids = Array.from({ length: 200 }, (_, i) => (60000 + i).toString());

  // אורגנים שתומכים בעדכונים
  const supportedOrgans = await p.organ.findMany({
    where: { supportsUpdates: true },
    select: { id: true, name: true },
  });
  console.log("Supported organs:", supportedOrgans.map(o => o.name).join(", "));

  // סט שלם
  const fullSet = await p.setType.findMany({
    where: { includesUpdates: true },
    select: { id: true, name: true },
  });
  console.log("Sets with updates:", fullSet.map(s => s.name).join(", "));

  if (supportedOrgans.length === 0 || fullSet.length === 0) {
    console.error("No supported organs or set types!");
    process.exit(1);
  }

  const fullSetId = fullSet[0].id;

  // כל הלקוחות הפייק
  const customers = await p.customer.findMany({
    where: { customerId: { in: ids } },
    select: { id: true, customerId: true, organId: true, setTypeId: true, updateExpiryDate: true },
  });

  let updatedOrgan = 0;
  let updatedSet = 0;
  let updatedExpiry = 0;
  const now = new Date();

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const data: any = {};

    // 80% לאורגנים נתמכים
    const isSupported = supportedOrgans.some(o => o.id === c.organId);
    if (!isSupported && i % 5 !== 0) {
      // רנדומלי מתוך האורגנים הנתמכים
      data.organId = supportedOrgans[i % supportedOrgans.length].id;
      updatedOrgan++;
    }

    // 80% סט שלם
    if (c.setTypeId !== fullSetId && i % 5 !== 0) {
      data.setTypeId = fullSetId;
      updatedSet++;
    }

    // תאריך תפוגה — כולם בתוקף (1-3 שנים קדימה)
    if (c.updateExpiryDate < now) {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1 + Math.floor(Math.random() * 2));
      future.setMonth(Math.floor(Math.random() * 12));
      data.updateExpiryDate = future;
      updatedExpiry++;
    }

    if (Object.keys(data).length > 0) {
      await p.customer.update({ where: { id: c.id }, data });
    }
  }

  console.log(`\nUpdated:`);
  console.log(`  Organs → supported: ${updatedOrgan}`);
  console.log(`  SetType → full set: ${updatedSet}`);
  console.log(`  Expiry → future: ${updatedExpiry}`);

  // בדיקה סופית
  const eligible = await p.customer.count({
    where: {
      customerId: { in: ids },
      status: { notIn: ["BLOCKED", "FROZEN"] },
      organ: { supportsUpdates: true },
      setType: { includesUpdates: true },
      OR: [
        { updateExpiryDate: { gte: now } },
        { status: "EXCEPTION" },
      ],
    },
  });
  console.log(`\nEligible customers now: ${eligible}`);

  await p.$disconnect();
}
run();
