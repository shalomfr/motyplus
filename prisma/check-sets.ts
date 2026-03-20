import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const setTypes = await prisma.setType.findMany({
    where: { isActive: true },
    select: { name: true, folderAlias: true },
    orderBy: { name: "asc" },
  });
  console.log("=== SetTypes ===");
  setTypes.forEach((s) => console.log(`  name: "${s.name}" | folderAlias: "${s.folderAlias || "(null)"}"`));

  const organs = await prisma.organ.findMany({
    where: { supportsUpdates: true },
    select: { name: true, folderAlias: true },
    orderBy: { name: "asc" },
  });
  console.log("\n=== Organs ===");
  organs.forEach((o) => console.log(`  name: "${o.name}" | folderAlias: "${o.folderAlias || "(null)"}"`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
