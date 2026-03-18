import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== מחיקת כל הלקוחות הקיימים ===");

  // מחיקת רשומות תלויות קודם
  await prisma.customerUpdate.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.activityLog.deleteMany({});
  await prisma.customer.deleteMany({});
  console.log("כל הלקוחות נמחקו.");

  // שליפת אורגנים וסטים
  const organs = await prisma.organ.findMany({ orderBy: { sortOrder: "asc" } });
  const sets = await prisma.setType.findMany({ orderBy: { sortOrder: "asc" } });

  const organMap = Object.fromEntries(organs.map(o => [o.name, o.id]));
  const setMap = Object.fromEntries(sets.map(s => [s.name, s.id]));

  const EMAIL = "beats@mottirozenfeld.com";
  const now = new Date();
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  const expired = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  // לקוחות דמו — כל שילוב ייחודי
  const customers = [
    // === אורגנים עם עדכונים (סטים שונים) ===
    {
      fullName: "אבי כהן",
      phone: "050-1111111",
      organ: "Tyros5-1G",
      set: "סט שלם",
      amount: 9500,
      version: "V5",
      hasV3: true,
      status: "ACTIVE" as const,
      sample: "CPI" as const,
      expiry: oneYearFromNow,
      notes: "לקוח VIP — סט שלם + מעודכן לגרסה אחרונה",
    },
    {
      fullName: "בני לוי",
      phone: "050-2222222",
      organ: "Tyros5-2G",
      set: "חצי סט",
      amount: 4500,
      version: "V3",
      hasV3: true,
      status: "ACTIVE" as const,
      sample: "CPI" as const,
      expiry: expired,
      notes: "חצי סט — פג תוקף עדכונים, צריך הצעת שדרוג",
    },
    {
      fullName: "גלית ברון",
      phone: "050-3333333",
      organ: "Genos",
      set: "3/4 סט",
      amount: 7000,
      version: "V4",
      hasV3: true,
      status: "ACTIVE" as const,
      sample: "CPI" as const,
      expiry: oneYearFromNow,
      notes: "3/4 סט — לא מעודכנת לגרסה האחרונה",
    },
    {
      fullName: "דוד מזרחי",
      phone: "050-4444444",
      organ: "Genos 2",
      set: "סט שלם",
      amount: 9500,
      version: "V5",
      hasV3: true,
      status: "ACTIVE" as const,
      sample: "CPF" as const,
      expiry: oneYearFromNow,
      notes: "Genos 2 + סט שלם + דגימות CPF — לקוח מושלם",
    },
    {
      fullName: "הדר שמש",
      phone: "050-5555555",
      organ: "PSR-SX920",
      set: "בסיס",
      amount: 3000,
      version: "V2",
      hasV3: false,
      status: "ACTIVE" as const,
      sample: "CPI" as const,
      expiry: expired,
      notes: "סט בסיס בלבד — לא עבר ל-V3, פוטנציאל לשדרוג",
    },

    // === אורגנים ללא עדכונים (סטים שונים) ===
    {
      fullName: "ורד אלון",
      phone: "050-6666666",
      organ: "PSR-SX720",
      set: "דנסים",
      amount: 5000,
      version: null,
      hasV3: false,
      status: "ACTIVE" as const,
      sample: "CPI" as const,
      expiry: expired,
      notes: "סט דנסים — אורגן ללא תמיכה בעדכונים",
    },
    {
      fullName: "זיו פרידמן",
      phone: "050-7777777",
      organ: "PSR-SX900",
      set: "לייב",
      amount: 4000,
      version: null,
      hasV3: false,
      status: "ACTIVE" as const,
      sample: "CPI" as const,
      expiry: expired,
      notes: "סט לייב — PSR-SX900",
    },
    {
      fullName: "חיים גולד",
      phone: "050-8888888",
      organ: "PSR-SX700",
      set: "קטרון + מוטיף",
      amount: 3500,
      version: null,
      hasV3: false,
      status: "ACTIVE" as const,
      sample: "CPI" as const,
      expiry: expired,
      notes: "קטרון + מוטיף — PSR-SX700",
    },
    {
      fullName: "טלי רוזן",
      phone: "050-9999999",
      organ: "PSR-S970",
      set: "סט שלם",
      amount: 9500,
      version: null,
      hasV3: false,
      status: "FROZEN" as const,
      sample: "CPI" as const,
      expiry: expired,
      notes: "לקוחה מוקפאת — סט שלם אבל לא פעילה",
    },
    {
      fullName: "יוסי נחמיאס",
      phone: "052-1010101",
      organ: "PSR-S975",
      set: "חצי סט",
      amount: 4500,
      version: null,
      hasV3: false,
      status: "ACTIVE" as const,
      sample: "CPI" as const,
      expiry: expired,
      notes: "חצי סט — PSR-S975",
    },
    {
      fullName: "כרמל אביב",
      phone: "052-1212121",
      organ: "PSR-A3000",
      set: "סט שלם",
      amount: 9500,
      version: null,
      hasV3: false,
      status: "ACTIVE" as const,
      sample: "CPI" as const,
      expiry: expired,
      notes: "PSR-A3000 — אורגן מזרחי, סט שלם",
    },
    {
      fullName: "לאה ביטון",
      phone: "052-1313131",
      organ: "PSR-S770",
      set: "בסיס",
      amount: 3000,
      version: null,
      hasV3: false,
      status: "ACTIVE" as const,
      sample: "CPI" as const,
      expiry: expired,
      notes: "סט בסיס — PSR-S770",
    },
    {
      fullName: "מאיר דהן",
      phone: "052-1414141",
      organ: "PSR-S775",
      set: "אחר",
      amount: 2000,
      version: null,
      hasV3: false,
      status: "ACTIVE" as const,
      sample: "CPI" as const,
      expiry: expired,
      discountReason: "מבצע מיוחד",
      notes: "סט 'אחר' מותאם אישית — PSR-S775, קיבל הנחה",
    },

    // === מקרים מיוחדים ===
    {
      fullName: "נועה שרון",
      phone: "053-1515151",
      organ: "Tyros5-1G",
      set: "דנסים",
      amount: 5000,
      version: "V3.5",
      hasV3: true,
      status: "ACTIVE" as const,
      sample: "CPI" as const,
      expiry: oneYearFromNow,
      isCasual: true,
      notes: "לקוחה מזדמנת — לא ברשימת עדכונים אוטומטית",
    },
    {
      fullName: "סמי חדד",
      phone: "053-1616161",
      organ: "Genos",
      set: "סט שלם",
      amount: 7000,
      version: "V5",
      hasV3: true,
      status: "EXCEPTION" as const,
      sample: "CPF" as const,
      expiry: oneYearFromNow,
      discountReason: "חבר אישי",
      notes: "סטטוס חריג — שילם פחות, CPF, Genos עם סט שלם",
    },
    {
      fullName: "עדי פינטו",
      phone: "053-1717171",
      organ: "Genos 2",
      set: "לייב",
      amount: 4000,
      version: "V4",
      hasV3: true,
      status: "BLOCKED" as const,
      sample: "CPI" as const,
      expiry: expired,
      notes: "לקוח חסום — בעיית תשלום, Genos 2 + לייב",
    },
  ];

  console.log(`=== יוצר ${customers.length} לקוחות דמו ===`);

  for (const c of customers) {
    const organId = organMap[c.organ];
    const setTypeId = setMap[c.set];

    if (!organId) { console.error(`אורגן לא נמצא: ${c.organ}`); continue; }
    if (!setTypeId) { console.error(`סט לא נמצא: ${c.set}`); continue; }

    await prisma.customer.create({
      data: {
        fullName: c.fullName,
        phone: c.phone,
        email: EMAIL,
        organId,
        setTypeId,
        amountPaid: c.amount,
        currentUpdateVersion: c.version,
        hasV3: c.hasV3,
        status: c.status,
        sampleType: c.sample,
        updateExpiryDate: c.expiry,
        purchaseDate: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        isCasual: c.isCasual || false,
        discountReason: c.discountReason || null,
        notes: c.notes,
      },
    });
    console.log(`  ✓ ${c.fullName} — ${c.organ} / ${c.set}${c.version ? ` / ${c.version}` : ""}`);
  }

  console.log(`\n=== סיום! נוצרו ${customers.length} לקוחות ===`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
