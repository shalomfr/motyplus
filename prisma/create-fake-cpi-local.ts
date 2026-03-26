import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const OUTPUT_DIR = path.resolve(__dirname, "../../fake-cpi-files");

// קובץ CPI פייק של 1KB
function createFakeCpi(): Buffer {
  const buf = Buffer.alloc(1024);
  buf.write("YCPI", 0, "ascii");
  for (let i = 4; i < 1024; i++) {
    buf[i] = Math.floor(Math.random() * 256);
  }
  return buf;
}

async function main() {
  // יצירת תיקייה
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("Fetching fake customers...");

  const customers = await prisma.customer.findMany({
    where: {
      customerId: {
        in: Array.from({ length: 200 }, (_, i) => (60000 + i).toString()),
      },
    },
    select: {
      customerId: true,
      additionalOrganId: true,
    },
  });

  console.log(`Found ${customers.length} fake customers`);

  const fakeCpi = createFakeCpi();
  let created = 0;

  for (const customer of customers) {
    // קובץ ראשי: {customerId}.cpi
    fs.writeFileSync(path.join(OUTPUT_DIR, `${customer.customerId}.cpi`), fakeCpi);
    created++;

    // אם יש אורגן נוסף: {customerId}_2.cpi
    if (customer.additionalOrganId) {
      fs.writeFileSync(path.join(OUTPUT_DIR, `${customer.customerId}_2.cpi`), fakeCpi);
      created++;
    }
  }

  console.log(`Done! Created ${created} CPI files in: ${OUTPUT_DIR}`);
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
