/**
 * בדיקת יצירת דף תשלום דרך Green Invoice (מורנינג).
 * הרצה מתיקיית motyroz:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/test-morning-payment.ts
 * (או וודא ש-DATABASE_URL ו-מפתח ההצפנה טעונים בסביבה.)
 */

import { prisma } from "../src/lib/prisma";
import { getBillingClientByProviderType } from "../src/lib/billing/get-client";

async function main() {
  const billing = await getBillingClientByProviderType("GREEN_INVOICE");
  if (!billing) {
    console.error("אין ספק GREEN_INVOICE פעיל במסד — הוסף מורנינג בהגדרות חיבורים.");
    process.exit(1);
  }

  const page = await billing.client.createPaymentPage({
    customer: {
      name: "בדיקת מערכת",
      email: "test@example.com",
      phone: "0500000000",
    },
    items: [{ description: "בדיקת מורנינג", quantity: 1, unitPrice: 1 }],
    successUrl: "https://example.com/order/ok",
    cancelUrl: "https://example.com/order/cancel",
    webhookUrl: "",
    docType: "invoice_receipt",
    metadata: { scriptTest: "1" },
  });

  if (!page.url) {
    console.error("לא התקבל URL ממורנינג");
    process.exit(1);
  }

  console.log("דף תשלום נוצר:");
  console.log(page.url);
  console.log("מזהה:", page.pageId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
