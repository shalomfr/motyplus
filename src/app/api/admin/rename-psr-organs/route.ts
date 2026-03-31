import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/admin/rename-psr-organs — one-time migration
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  }

  const organs = await prisma.organ.findMany();
  const psrOrgans = organs.filter((o) => o.name.startsWith("PSR-"));
  const log: string[] = [];

  for (const organ of psrOrgans) {
    const newName = organ.name.replace(/^PSR-/, "Psr-");
    const existing = organs.find((o) => o.name === newName && o.id !== organ.id);

    if (existing) {
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
      await prisma.organ.delete({ where: { id: organ.id } });
      log.push(`Merged "${organ.name}" → "${existing.name}" (${movedMain.count} main, ${movedAdditional.count} additional)`);
    } else {
      await prisma.organ.update({
        where: { id: organ.id },
        data: {
          name: newName,
          folderAlias: organ.folderAlias?.replace(/^PSR-/, "Psr-") || null,
          demoAlias: organ.demoAlias?.replace(/^PSR-/, "Psr-") || null,
        },
      });
      log.push(`Renamed "${organ.name}" → "${newName}"`);
    }
  }

  return NextResponse.json({ updated: psrOrgans.length, log });
}
