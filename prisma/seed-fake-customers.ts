import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// שמות פייק בעברית
const firstNames = [
  "דוד", "משה", "יוסף", "אברהם", "יעקב", "שמואל", "חיים", "אליהו", "מנחם", "נתן",
  "שרה", "רחל", "לאה", "מרים", "חנה", "דבורה", "אסתר", "רבקה", "נעמי", "תמר",
  "יצחק", "בנימין", "דניאל", "רפאל", "גבריאל", "עמוס", "אורי", "ניר", "רון", "גיל",
  "שירה", "יעל", "הדס", "אביגיל", "מיכל", "נועה", "ליאת", "ענת", "סיגל", "אורלי",
  "עמנואל", "אהרון", "שלמה", "ישראל", "מאיר", "צבי", "ברוך", "פנחס", "זאב", "אשר",
];

const lastNames = [
  "כהן", "לוי", "מזרחי", "פרץ", "ביטון", "אברהם", "דוד", "אוחיון", "חדד", "עמר",
  "פרידמן", "גולדשטיין", "רוזנברג", "שוורץ", "קליין", "ברגר", "הלפרין", "וייס", "בלום", "שפירא",
  "גבאי", "סויסה", "אלון", "בר", "שמש", "מלכה", "חזן", "יוסף", "נחום", "אדרי",
  "שטרן", "הורוביץ", "גרינברג", "ליבוביץ", "קפלן", "זילברשטיין", "פינקלשטיין", "רוטשילד", "אפשטיין", "מנדלבאום",
];

const phoneNumbers = [
  "050", "052", "053", "054", "058",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPhone(): string {
  const prefix = randomFrom(phoneNumbers);
  const num = randomInt(1000000, 9999999).toString();
  return `${prefix}-${num}`;
}

function randomDate(startYear: number, endYear: number): Date {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start));
}

async function main() {
  console.log("Creating 200 fake customers...");

  // קבלת IDs מהדאטאבייס
  const organs = await prisma.organ.findMany({ orderBy: { sortOrder: "asc" } });
  const setTypes = await prisma.setType.findMany({ orderBy: { sortOrder: "asc" } });

  if (organs.length === 0 || setTypes.length === 0) {
    console.error("No organs or set types found! Run the main seed first.");
    process.exit(1);
  }

  console.log(`Found ${organs.length} organs and ${setTypes.length} set types`);

  const statuses: Array<"ACTIVE" | "PENDING_APPROVAL" | "BLOCKED" | "FROZEN" | "EXCEPTION"> = [
    "ACTIVE", "PENDING_APPROVAL", "BLOCKED", "FROZEN", "EXCEPTION",
  ];

  // משקלות לסטטוסים — רוב פעילים
  const statusWeights = [120, 30, 20, 15, 15]; // סה"כ 200

  const updateVersions = [
    null, null, // חלק בלי גרסה
    "V3", "V3.1", "V3.2", "V3.3", "V3.4", "V3.5", "V3.8",
    "V4", "V4", "V4",
    "V5", "V5", "V5",
  ];

  const discountReasons = [
    null, null, null, null, null, // רוב בלי הנחה
    "מבצע קיץ", "הנחת נאמנות", "קופון 10%", "חבר מועדון", "הנחה מיוחדת",
  ];

  // בניית רשימת סטטוסים לפי משקל
  const statusList: typeof statuses[number][] = [];
  for (let i = 0; i < statuses.length; i++) {
    for (let j = 0; j < statusWeights[i]; j++) {
      statusList.push(statuses[i]);
    }
  }

  // ערבוב
  for (let i = statusList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [statusList[i], statusList[j]] = [statusList[j], statusList[i]];
  }

  const customers: any[] = [];

  for (let i = 0; i < 200; i++) {
    const firstName = randomFrom(firstNames);
    const lastName = randomFrom(lastNames);
    const fullName = `${firstName} ${lastName}`;
    const organ = randomFrom(organs);
    const setType = randomFrom(setTypes);
    const status = statusList[i];
    const purchaseDate = randomDate(2022, 2026);
    const expiryDate = new Date(purchaseDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + randomInt(1, 3));

    // hasV3 — רק אם יש גרסה >= V3
    const currentVersion = randomFrom(updateVersions);
    const hasV3 = currentVersion !== null && currentVersion.startsWith("V3");

    // isCasual — 15% מזדמנים
    const isCasual = Math.random() < 0.15;

    // אורגן נוסף — 30%
    const hasAdditionalOrgan = Math.random() < 0.30;
    const additionalOrgan = hasAdditionalOrgan
      ? randomFrom(organs.filter((o) => o.id !== organ.id))
      : null;

    // סכום — לפי סוג סט + קצת רנדום
    const basePrice = Number(setType.price);
    const discount = randomFrom(discountReasons);
    const amountPaid = discount ? basePrice * (randomInt(70, 95) / 100) : basePrice;

    // customerId — מספר ייחודי (5 ספרות)
    const customerId = (60000 + i).toString();

    customers.push({
      fullName,
      phone: randomPhone(),
      whatsappPhone: Math.random() < 0.7 ? randomPhone() : null,
      address: Math.random() < 0.5 ? `רח׳ ${randomFrom(["הרצל", "ז׳בוטינסקי", "בן גוריון", "ויצמן", "רוטשילד", "דיזנגוף", "אלנבי", "בגין", "רבין", "שמעון פרס"])} ${randomInt(1, 120)}, ${randomFrom(["תל אביב", "ירושלים", "חיפה", "באר שבע", "נתניה", "ראשון לציון", "פתח תקווה", "אשדוד", "בני ברק", "חולון"])}` : null,
      email: "shalomkf@gmail.com",
      purchaseDate,
      updateExpiryDate: expiryDate,
      organId: organ.id,
      additionalOrganId: additionalOrgan?.id || null,
      setTypeId: setType.id,
      customerId,
      amountPaid,
      discountReason: discount,
      status,
      currentUpdateVersion: currentVersion,
      hasV3,
      isCasual,
      notes: Math.random() < 0.2 ? randomFrom([
        "לקוח ותיק, אוהב מזרחית",
        "מתעניין בעדכון הבא",
        "ביקש הנחה על העדכון",
        "נגן מקצועי, מופיע באירועים",
        "מורה למוזיקה",
        "רוצה לשדרג לסט שלם",
        "שילם בתשלומים",
        "הגיע דרך המלצה",
        "לקוח VIP",
        "צריך תמיכה טכנית מדי פעם",
      ]) : null,
    });
  }

  console.log("Inserting customers...");

  let created = 0;
  for (const customer of customers) {
    try {
      await prisma.customer.create({ data: customer });
      created++;
      if (created % 50 === 0) {
        console.log(`Created ${created}/200...`);
      }
    } catch (err: any) {
      console.error(`Failed to create ${customer.fullName} (${customer.customerId}):`, err.message);
    }
  }

  console.log(`Done! Created ${created} fake customers.`);
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
