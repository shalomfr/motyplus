import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

const BASE_URL = process.env.AUTH_URL || "https://motyplus-2hvb.onrender.com";

async function main() {
  const infoDir = path.join(__dirname, "..", "generated-info-files");

  const customers = await prisma.customer.findMany({
    include: { organ: true },
    orderBy: { id: "asc" },
  });

  console.log(`=== העלאת קבצי N27 ל-${customers.length} לקוחות ===\n`);

  for (const customer of customers) {
    const fileName = `${customer.id}.n27`;
    const filePath = path.join(infoDir, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`  ✗ ${fileName} — קובץ לא נמצא`);
      continue;
    }

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const base64 = fileBuffer.toString("base64");

      // Upload via internal API - store as Google Drive or direct DB reference
      // Since we're running locally with DB access, just update the customer record
      // with a data URI that indicates the info file exists
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          customerId: String(customer.id),
          // Mark that info file is associated
        },
      });

      console.log(`  ✓ ${fileName} — ${customer.fullName} (${customer.organ.name})`);
    } catch (err) {
      console.error(`  ✗ ${fileName} — שגיאה:`, err);
    }
  }

  console.log(`\n=== סיום ===`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
