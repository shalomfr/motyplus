/**
 * Migration script: Rename "PSR-xxx" organs to "Psr-xxx" and merge duplicates.
 * Run with: npx tsx prisma/rename-psr-organs.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const organs = await prisma.organ.findMany();

  const psrOrgans = organs.filter((o) => o.name.startsWith("PSR-"));
  console.log(`Found ${psrOrgans.length} organs starting with "PSR-"`);

  for (const organ of psrOrgans) {
    const newName = organ.name.replace(/^PSR-/, "Psr-");

    // Check if "Psr-xxx" already exists (duplicate)
    const existing = organs.find((o) => o.name === newName && o.id !== organ.id);

    if (existing) {
      // Merge: move all customers from the PSR- organ to the Psr- organ
      console.log(`Merging "${organ.name}" (${organ.id}) into "${existing.name}" (${existing.id})`);

      const [movedMain, movedAdditional] = await Promise.all([
        prisma.customer.updateMany({
          where: { organId: organ.id },
          data: { organId: existing.id },
        }),
        prisma.customer.updateMany({
          where: { additionalOrganId: organ.id },
          data: { additionalOrganId: existing.id },
        }),
      ]);

      console.log(`  Moved ${movedMain.count} customers (main), ${movedAdditional.count} (additional)`);

      // Delete the old PSR- organ
      await prisma.organ.delete({ where: { id: organ.id } });
      console.log(`  Deleted organ "${organ.name}"`);
    } else {
      // Simply rename
      await prisma.organ.update({
        where: { id: organ.id },
        data: {
          name: newName,
          folderAlias: organ.folderAlias?.replace(/^PSR-/, "Psr-") || null,
          demoAlias: organ.demoAlias?.replace(/^PSR-/, "Psr-") || null,
        },
      });
      console.log(`Renamed "${organ.name}" → "${newName}"`);
    }
  }

  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
