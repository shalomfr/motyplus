import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ===== יצירת משתמש אדמין =====
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@motyplus.com" },
    update: {},
    create: {
      email: "admin@motyplus.com",
      name: "מנהל מערכת",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });
  console.log("Admin user created:", admin.email);

  // ===== רשימת אורגנים =====
  const organs = [
    { name: "Tyros5-1G", folderAlias: "Tyros5-1G", supportsUpdates: true, sortOrder: 1 },
    { name: "Tyros5-2G", folderAlias: "Tyros5-2G", supportsUpdates: true, sortOrder: 2 },
    { name: "Genos", folderAlias: "Genos", supportsUpdates: true, sortOrder: 3 },
    { name: "Genos 2", folderAlias: "Genos2", supportsUpdates: true, sortOrder: 4 },
    { name: "PSR-SX920", folderAlias: "PSR-SX920", supportsUpdates: true, sortOrder: 5 },
    { name: "PSR-SX720", supportsUpdates: false, sortOrder: 6 },
    { name: "PSR-SX900", supportsUpdates: false, sortOrder: 7 },
    { name: "PSR-SX700", supportsUpdates: false, sortOrder: 8 },
    { name: "PSR-S970 / S975", supportsUpdates: false, sortOrder: 9 },
    { name: "PSR-A3000", supportsUpdates: false, sortOrder: 10 },
    { name: "PSR-S770 / S775", supportsUpdates: false, sortOrder: 11 },
  ];

  for (const organ of organs) {
    await prisma.organ.upsert({
      where: { name: organ.name },
      update: organ,
      create: organ,
    });
  }
  console.log("Organs seeded:", organs.length);

  // ===== סוגי סטים =====
  const setTypes = [
    { name: "בסיס", folderAlias: "basis", price: 3000, includesUpdates: false, sortOrder: 1 },
    { name: "חצי סט", folderAlias: "half", price: 4500, includesUpdates: false, sortOrder: 2 },
    { name: "3/4 סט", folderAlias: "3quarter", price: 7000, includesUpdates: false, sortOrder: 3 },
    { name: "סט שלם", folderAlias: "full", price: 9500, includesUpdates: true, sortOrder: 4 },
    { name: "קטרון + מוטיף", folderAlias: "katron-motif", price: 3500, includesUpdates: false, sortOrder: 5 },
    { name: "דנסים", folderAlias: "dances", price: 5000, includesUpdates: false, sortOrder: 6 },
    { name: "לייב", folderAlias: "live", price: 4000, includesUpdates: false, sortOrder: 7 },
    { name: "אחר", folderAlias: "other", price: 0, includesUpdates: false, sortOrder: 8 },
  ];

  for (const setType of setTypes) {
    await prisma.setType.upsert({
      where: { name: setType.name },
      update: setType,
      create: setType,
    });
  }
  console.log("Set types seeded:", setTypes.length);

  // ===== עדכונים ומחירים =====
  const updateVersions = [
    { version: "V1", price: 1000, sortOrder: 1 },
    { version: "V1.1", price: 400, sortOrder: 2 },
    { version: "V1.5", price: 100, sortOrder: 3 },
    { version: "V2", price: 100, sortOrder: 4 },
    { version: "V2.1", price: 200, sortOrder: 5 },
    { version: "V2.2", price: 400, sortOrder: 6 },
    { version: "V3", price: 1000, sortOrder: 7 },
    { version: "V3.1", price: 150, sortOrder: 8 },
    { version: "V3.2", price: 200, sortOrder: 9 },
    { version: "V3.3", price: 300, sortOrder: 10 },
    { version: "V3.4", price: 500, sortOrder: 11 },
    { version: "V3.5", price: 700, sortOrder: 12 },
    { version: "V3.8", price: 700, sortOrder: 13 },
    { version: "V4", price: 997, sortOrder: 14 },
    { version: "V5", price: 499, sortOrder: 15 },
  ];

  for (const uv of updateVersions) {
    await prisma.updateVersion.upsert({
      where: { version: uv.version },
      update: uv,
      create: {
        ...uv,
        status: "COMPLETED",
      },
    });
  }
  console.log("Update versions seeded:", updateVersions.length);

  // ===== תבניות מייל בסיסיות =====
  const emailTemplates = [
    {
      name: "ברכת קנייה",
      subject: "ברוכים הבאים ל-MotyPlus! 🎹",
      body: `<div dir="rtl" style="font-family: Arial, sans-serif;">
<h2>שלום {{customerName}},</h2>
<p>תודה רבה על רכישת {{setType}} לאורגן {{organName}}!</p>
<p>מספר הלקוח שלך: <strong>{{customerId}}</strong></p>
<p>אנחנו כאן בשבילך לכל שאלה.</p>
<p>בברכה,<br>צוות MotyPlus</p>
</div>`,
      category: "קנייה",
      variables: ["customerName", "setType", "organName", "customerId"],
    },
    {
      name: "שליחת עדכון",
      subject: "עדכון {{updateVersion}} מוכן עבורך!",
      body: `<div dir="rtl" style="font-family: Arial, sans-serif;">
<h2>שלום {{customerName}},</h2>
<p>עדכון {{updateVersion}} מוכן עבורך!</p>
<p>העדכון כולל מקצבים ודגימות חדשות לאורגן {{organName}} שלך.</p>
<p>לחץ על הקישור להורדה:</p>
<p><a href="{{downloadLink}}">הורדת העדכון</a></p>
<p>בברכה,<br>צוות MotyPlus</p>
</div>`,
      category: "עדכון",
      variables: ["customerName", "updateVersion", "organName", "downloadLink"],
    },
    {
      name: "תזכורת עדכון",
      subject: "לא הורדת את העדכון האחרון",
      body: `<div dir="rtl" style="font-family: Arial, sans-serif;">
<h2>שלום {{customerName}},</h2>
<p>שמנו לב שעדיין לא הורדת את עדכון {{updateVersion}}.</p>
<p>העדכון כולל תכנים חדשים ומרגשים!</p>
<p><a href="{{downloadLink}}">לחץ כאן להורדה</a></p>
<p>בברכה,<br>צוות MotyPlus</p>
</div>`,
      category: "תזכורת",
      variables: ["customerName", "updateVersion", "downloadLink"],
    },
    {
      name: "הצעת מחיר",
      subject: "הצעת מחיר אישית עבורך",
      body: `<div dir="rtl" style="font-family: Arial, sans-serif;">
<h2>שלום {{customerName}},</h2>
<p>להלן פירוט היתרה שלך:</p>
<ul>
<li>סכום ששולם: {{amountPaid}}</li>
<li>יתרה לתשלום: {{balance}}</li>
</ul>
<p>לתשלום מיידי: <a href="{{paymentLink}}">לחץ כאן</a></p>
{{#couponCode}}<p>קוד קופון: <strong>{{couponCode}}</strong></p>{{/couponCode}}
<p>בברכה,<br>צוות MotyPlus</p>
</div>`,
      category: "תשלום",
      variables: ["customerName", "amountPaid", "balance", "paymentLink", "couponCode"],
    },
  ];

  for (const template of emailTemplates) {
    const existing = await prisma.emailTemplate.findFirst({
      where: { name: template.name },
    });
    if (!existing) {
      await prisma.emailTemplate.create({ data: template });
    }
  }
  console.log("Email templates seeded:", emailTemplates.length);

  console.log("Seeding complete!");
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
