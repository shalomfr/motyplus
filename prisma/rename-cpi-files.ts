import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const DIR = path.resolve(__dirname, "../../fake-cpi-files");

async function main() {
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

  console.log(`Found ${customers.length} customers`);

  let renamed = 0;
  for (const c of customers) {
    // ראשי: customerId.cpi → id.cpi
    const oldMain = path.join(DIR, `${c.customerId}.cpi`);
    const newMain = path.join(DIR, `${c.id}.cpi`);
    if (fs.existsSync(oldMain)) {
      fs.renameSync(oldMain, newMain);
      renamed++;
    }

    // נוסף: customerId_2.cpi → id_2.cpi
    if (c.additionalOrganId) {
      const oldAdd = path.join(DIR, `${c.customerId}_2.cpi`);
      const newAdd = path.join(DIR, `${c.id}_2.cpi`);
      if (fs.existsSync(oldAdd)) {
        fs.renameSync(oldAdd, newAdd);
        renamed++;
      }
    }
  }

  console.log(`Renamed ${renamed} files.`);
  await prisma.$disconnect();
}

main();
