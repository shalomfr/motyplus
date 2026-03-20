import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // רשימת עדכונים קיימים
  const versions = await prisma.updateVersion.findMany({
    orderBy: { sortOrder: "desc" },
    select: { id: true, version: true, status: true },
  });

  if (versions.length === 0) {
    console.log("אין עדכונים במערכת. צריך ליצור עדכון קודם.");
    return;
  }

  console.log("עדכונים קיימים:");
  for (const v of versions) {
    console.log(`  ${v.version} (${v.id}) — ${v.status}`);
  }

  // בחירת העדכון האחרון
  const latest = versions[0];
  console.log(`\nשולח עדכון ${latest.version} (${latest.id})...`);

  // מציאת לקוחות זכאים
  const now = new Date();
  const alreadyReceived = await prisma.customerUpdate.findMany({
    where: { updateVersionId: latest.id },
    select: { customerId: true },
  });
  const alreadyIds = alreadyReceived.map(c => c.customerId);

  const eligible = await prisma.customer.findMany({
    where: {
      id: { notIn: alreadyIds.length > 0 ? alreadyIds : [-1] },
      status: { in: ["ACTIVE", "EXCEPTION"] },
      isCasual: false,
      organ: { supportsUpdates: true },
      OR: [
        { updateExpiryDate: { gte: now } },
        { status: "EXCEPTION" },
      ],
    },
    include: {
      organ: { select: { name: true } },
      setType: { select: { name: true } },
    },
  });

  console.log(`\nלקוחות זכאים: ${eligible.length}`);
  for (const c of eligible) {
    console.log(`  ${c.id} ${c.fullName} — ${c.organ.name} / ${c.setType.name}`);
  }

  if (eligible.length === 0) {
    console.log("אין לקוחות זכאים.");
    return;
  }

  // יצירת רשומות CustomerUpdate + עדכון גרסה
  let sent = 0;
  for (const c of eligible) {
    try {
      await prisma.customerUpdate.create({
        data: {
          customerId: c.id,
          updateVersionId: latest.id,
          sentAt: now,
        },
      });

      await prisma.customer.update({
        where: { id: c.id },
        data: { currentUpdateVersion: latest.version },
      });

      console.log(`  ✓ ${c.fullName} — עדכון ${latest.version} נשלח`);
      sent++;
    } catch (err) {
      console.error(`  ✗ ${c.fullName} — שגיאה:`, err);
    }
  }

  // עדכון סטטוס
  if (sent > 0) {
    await prisma.updateVersion.update({
      where: { id: latest.id },
      data: { status: "COMPLETED" },
    });
  }

  console.log(`\n=== סיום: ${sent}/${eligible.length} לקוחות עודכנו ל-${latest.version} ===`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
