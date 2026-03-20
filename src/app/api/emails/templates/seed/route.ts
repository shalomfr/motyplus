import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { blocksToHtml } from "@/components/emails/block-editor/blocks-to-html";
import type { EmailBlock } from "@/components/emails/block-editor/types";
import { generateBlockId } from "@/components/emails/block-editor/types";

function b(type: EmailBlock["type"], props: Omit<EmailBlock, "type" | "id">): EmailBlock {
  return { type, id: generateBlockId(), ...props } as EmailBlock;
}

interface TemplateDefinition {
  name: string;
  subject: string;
  category: string;
  variables: string[];
  blocks: EmailBlock[];
}

const TEMPLATES: TemplateDefinition[] = [
  // ===== מעודכנים Tyros 5 - 1G =====
  {
    name: "עדכון — Tyros 5 (1G)",
    subject: "עדכון {{updateVersion}} מוכן עבורך!",
    category: "update",
    variables: ["fullName", "updateVersion", "samplesLink", "rhythmsLink"],
    blocks: [
      b("heading", { text: "עדכון {{updateVersion}} - {{תאריך}}" }),
      b("paragraph", { text: "שלום {{fullName}}" }),
      b("paragraph", { text: "אני שמח לבשר על עדכון חדש ומטורף - עדכון שמשנה את כללי המשחק!\nעדכון {{updateVersion}} כולל המון שיפורים ותוספות בכל סוגי הז'אנרים, ומביא את הנגינה שלך לרמה הגבוהה ביותר." }),
      b("paragraph", { text: "זה הזמן לקחת את הנגינה שלך צעד קדימה - כולם יאהבו לשמוע אותך!" }),
      b("banner", { text: "מה חדש בעדכון?", color: "orange" }),
      b("paragraph", { text: "(תוכן העדכון ישתנה לפי כל גרסה — ערוך כאן)" }),
      b("banner", { text: "הוראות הורדה והתקנה", color: "blue" }),
      b("paragraph", { text: "הורד את הקבצים הבאים מהקישורים למטה והעתק ל-USB (בחוץ, לא בתוך תיקייה):\nתיקייה: HD1\nקובץ: {{שם קובץ מקצבים}}" }),
      b("paragraph", { text: "לאחר הורדת תיקיית HD1 מהדרייב יש לחלץ את התיקייה." }),
      b("paragraph", { text: "מחק תיקיות ישנות מהעדכונים הקודמים ב-HD1:\nכניסה למסך מקצבים → לחיצה על כפתור TAG מעבר ל-HD1 → כפתור 8 מתחת למסך (Menu 2) → כפתור 5 למטה → סימון התיקיות למחיקה → כפתור 7 → אישור ב-OK (F) ואז YES במסך." }),
      b("paragraph", { text: "העתק את התיקיות שנמצאות בתוך HD1 שב-USB (ולא את כל תיקיית HD1 עצמה) ל-HD1 שבאורגן." }),
      b("paragraph", { text: "התקן מקצבים (BUP).\nהתקן דגימות.\nמצורף סרטון הסבר מלא לכל שלבי ההתקנה." }),
      b("warning", { text: "הושקעו מאות שעות עבודה בכדי שכמה שיותר מהחומרים יעבדו בצורה מיטבית גם על גיגה אחת.\nיחד עם זאת, לא הייתה ברירה וחלק מהחומרים הורדו בגלל מגבלת הנפח." }),
      b("buttons", { buttons: [{ label: "דגימות", url: "{{samplesLink}}", color: "gold" }, { label: "מקצבים", url: "{{rhythmsLink}}", color: "gold" }] }),
      b("signature", {}),
    ],
  },

  // ===== מעודכנים Tyros 5 - 2G =====
  {
    name: "עדכון — Tyros 5 (2G)",
    subject: "עדכון {{updateVersion}} מוכן עבורך!",
    category: "update",
    variables: ["fullName", "updateVersion", "samplesLink", "rhythmsLink"],
    blocks: [
      b("heading", { text: "עדכון {{updateVersion}} - {{תאריך}}" }),
      b("paragraph", { text: "שלום {{fullName}}" }),
      b("paragraph", { text: "אני שמח לבשר על עדכון חדש ומטורף - עדכון שמשנה את כללי המשחק!\nעדכון {{updateVersion}} כולל המון שיפורים ותוספות בכל סוגי הז'אנרים, ומביא את הנגינה שלך לרמה הגבוהה ביותר." }),
      b("paragraph", { text: "זה הזמן לקחת את הנגינה שלך צעד קדימה - כולם יאהבו לשמוע אותך!" }),
      b("banner", { text: "מה חדש בעדכון?", color: "orange" }),
      b("paragraph", { text: "(תוכן העדכון ישתנה לפי כל גרסה — ערוך כאן)" }),
      b("banner", { text: "הוראות הורדה והתקנה", color: "blue" }),
      b("paragraph", { text: "הורד את הקבצים הבאים מהקישורים למטה והעתק ל-USB (בחוץ, לא בתוך תיקייה):\nתיקייה: HD1\nקובץ: {{שם קובץ מקצבים}}" }),
      b("paragraph", { text: "לאחר הורדת תיקיית HD1 מהדרייב יש לחלץ את התיקייה." }),
      b("paragraph", { text: "מחק תיקיות ישנות מהעדכונים הקודמים ב-HD1." }),
      b("paragraph", { text: "העתק את התיקיות שנמצאות בתוך HD1 שב-USB ל-HD1 שבאורגן." }),
      b("paragraph", { text: "התקן מקצבים (BUP).\nהתקן דגימות.\nמצורף סרטון הסבר מלא לכל שלבי ההתקנה." }),
      b("buttons", { buttons: [{ label: "דגימות", url: "{{samplesLink}}", color: "gold" }, { label: "מקצבים", url: "{{rhythmsLink}}", color: "gold" }] }),
      b("signature", {}),
    ],
  },

  // ===== מעודכנים Genos / PSR-SX920 =====
  {
    name: "עדכון — Genos / PSR-SX920",
    subject: "עדכון {{updateVersion}} מוכן עבורך!",
    category: "update",
    variables: ["fullName", "updateVersion", "samplesLink", "rhythmsLink"],
    blocks: [
      b("heading", { text: "עדכון {{updateVersion}} - {{תאריך}}" }),
      b("paragraph", { text: "שלום {{fullName}}" }),
      b("paragraph", { text: "אני שמח לבשר על עדכון חדש ומטורף - עדכון שמשנה את כללי המשחק!\nעדכון {{updateVersion}} כולל המון שיפורים ותוספות בכל סוגי הז'אנרים, ומביא את הנגינה שלך לרמה הגבוהה ביותר." }),
      b("paragraph", { text: "זה הזמן לקחת את הנגינה שלך צעד קדימה - כולם יאהבו לשמוע אותך!" }),
      b("banner", { text: "מה חדש בעדכון?", color: "orange" }),
      b("paragraph", { text: "(תוכן העדכון ישתנה לפי כל גרסה — ערוך כאן)" }),
      b("banner", { text: "הוראות הורדה והתקנה", color: "blue" }),
      b("paragraph", { text: "הורד את הקובץ התקנה מהקישורים למטה, והעתק ל-USB (בחוץ, לא בתוך תיקייה):\nקובץ: {{שם קובץ מקצבים}}" }),
      b("paragraph", { text: "לפני שאתה ניגש להתקנת המקצבים - נא למחוק את כל התיקיות שיש ב-USER.\nהתקן מקצבים (BUP).\nהתקן דגימות. נא לשים לב להשתמש להתקנת הדגימות רק עם דיסק און קי איכותי מברזל USB.3" }),
      b("paragraph", { text: "מצורף סרטון הסבר מלא לכל שלב ההתקנה." }),
      b("buttons", { buttons: [{ label: "דגימות", url: "{{samplesLink}}", color: "gold" }, { label: "מקצבים", url: "{{rhythmsLink}}", color: "gold" }] }),
      b("signature", {}),
    ],
  },

  // ===== לא מעודכנים — סט שלם =====
  {
    name: "הצעת מחיר — למי שלא מעודכן",
    subject: "עדכון חדש ממתין לך — הצעה מיוחדת",
    category: "promotion",
    variables: ["fullName", "firstName", "organ", "currentVersion", "remainingAmount", "remainingForFullSet"],
    blocks: [
      b("heading", { text: "עדכון {{updateVersion}} - {{תאריך}}" }),
      b("paragraph", { text: "שלום {{fullName}}" }),
      b("paragraph", { text: "אני שמח לבשר על עדכון חדש ומטורף - עדכון שמשנה את כללי המשחק!\nעדכון {{updateVersion}} כולל המון שיפורים ותוספות בכל סוגי הז'אנרים, ומביא את הנגינה שלך לרמה הגבוהה ביותר.\nזה הזמן לקחת את הנגינה שלך צעד קדימה - כולם יאהבו לשמוע אותך!" }),
      b("banner", { text: "מה חדש בעדכון?", color: "orange" }),
      b("paragraph", { text: "(תוכן העדכון ישתנה לפי כל גרסה — ערוך כאן)" }),
      b("buttons", { buttons: [{ label: "דרייב", url: "{{driveLink}}", color: "green" }, { label: "יוטיוב", url: "{{youtubeLink}}", color: "red" }] }),
      b("banner", { text: "מחיר העדכון ופרטי תשלום", color: "blue" }),
      b("paragraph", { text: "מחיר העדכון הנוכחי: {{remainingAmount}} ₪\nיתרה לתשלום להשלמת העדכונים: {{remainingForFullSet}}" }),
      b("promo", { text: "לרגל ההשקה של העדכון החדש\nאני יוצא במבצע מיוחד:\n10% הנחה\nעל כל העדכונים.", price: "{{מחיר מבצע}} ₪", expiry: "30/09/25 בשעה 00:00" }),
      b("bankTable", {}),
      b("paragraph", { text: "זה הזמן לשדרג את האורגן שלך לעדכון {{updateVersion}} - ולהצטרף למאות מוזיקאים שכבר נהנים מהסאונד החדש!" }),
      b("signature", {}),
    ],
  },

  // ===== לא מעודכנים — חצי סט =====
  {
    name: "הצעה לחצאי סטים",
    subject: "שדרג את הסט שלך — הצעה מיוחדת",
    category: "promotion",
    variables: ["fullName", "firstName", "organ", "setType", "remainingForFullSet"],
    blocks: [
      b("heading", { text: "עדכון {{updateVersion}} - {{תאריך}}" }),
      b("paragraph", { text: "שלום {{fullName}}" }),
      b("paragraph", { text: "אני שמח לבשר על עדכון חדש ומטורף - עדכון שמשנה את כללי המשחק!\nעדכון {{updateVersion}} כולל המון שיפורים ותוספות בכל סוגי הז'אנרים, ומביא את הנגינה שלך לרמה הגבוהה ביותר.\nזה הזמן לקחת את הנגינה שלך צעד קדימה - כולם יאהבו לשמוע אותך!" }),
      b("banner", { text: "מה חדש בעדכון?", color: "orange" }),
      b("paragraph", { text: "(תוכן העדכון ישתנה לפי כל גרסה — ערוך כאן)" }),
      b("buttons", { buttons: [{ label: "דרייב", url: "{{driveLink}}", color: "green" }, { label: "יוטיוב", url: "{{youtubeLink}}", color: "red" }] }),
      b("banner", { text: "מחיר העדכון ופרטי תשלום", color: "blue" }),
      b("paragraph", { text: "יתרה לתשלום להשלמת הסט: {{remainingForFullSet}}" }),
      b("promo", { text: "לרגל ההשקה של העדכון החדש\nאני יוצא במבצע מיוחד:\n10% הנחה\nעל כל העדכונים - זו ההזדמנות שלך לשדרג לסט מלא עם כל התוספות והעדכונים!", price: "{{מחיר מבצע}} ₪", expiry: "30/09/25 בשעה 00:00" }),
      b("bankTable", {}),
      b("paragraph", { text: "זה הזמן לשדרג את האורגן שלך לעדכון {{updateVersion}} - ולהצטרף למאות מוזיקאים שכבר נהנים מהסאונד החדש!" }),
      b("signature", {}),
    ],
  },

  // ===== אחרי קניית עדכון — Tyros 5 =====
  {
    name: "אחרי קניית עדכון — Tyros 5",
    subject: "עדכון {{updateVersion}} - מוטי פלוס",
    category: "update",
    variables: ["fullName", "updateVersion", "samplesLink", "rhythmsLink"],
    blocks: [
      b("heading", { text: "עדכון {{updateVersion}} - {{תאריך}}" }),
      b("paragraph", { text: "שלום {{fullName}}," }),
      b("paragraph", { text: "תודה רבה על רכישת עדכון {{updateVersion}}.\nאני בטוח שתהנה מהעדכון החדש ותפיק ממנו את המירב." }),
      b("banner", { text: "הוראות הורדה והתקנה", color: "blue" }),
      b("paragraph", { text: "הורד את הקבצים הבאים מהקישורים למטה והעתק ל-USB (בחוץ, לא בתוך תיקייה):\nתיקייה: HD1\nקובץ: {{שם קובץ מקצבים}}" }),
      b("paragraph", { text: "לאחר הורדת תיקיית HD1 מהדרייב יש לחלץ את התיקייה." }),
      b("paragraph", { text: "מחק תיקיות ישנות מהעדכונים הקודמים ב-HD1." }),
      b("warning", { text: "נא לא למחוק את התיקייה 00songs reka (נעימות סעודה)." }),
      b("paragraph", { text: "העתק את התיקיות שנמצאות בתוך HD1 שב-USB ל-HD1 שבאורגן." }),
      b("paragraph", { text: "התקן מקצבים (BUP).\nהתקן דגימות.\nמצורף סרטון הסבר מלא לכל שלבי ההתקנה." }),
      b("buttons", { buttons: [{ label: "דגימות", url: "{{samplesLink}}", color: "gold" }, { label: "מקצבים", url: "{{rhythmsLink}}", color: "gold" }] }),
      b("signature", {}),
    ],
  },

  // ===== אחרי קניית עדכון — Genos / PSR-SX920 =====
  {
    name: "אחרי קניית עדכון — Genos / PSR-SX920",
    subject: "עדכון {{updateVersion}} - מוטי פלוס",
    category: "update",
    variables: ["fullName", "updateVersion", "samplesLink", "rhythmsLink"],
    blocks: [
      b("heading", { text: "עדכון {{updateVersion}} - {{תאריך}}" }),
      b("paragraph", { text: "שלום {{fullName}}," }),
      b("paragraph", { text: "תודה רבה על רכישת עדכון {{updateVersion}}.\nאני בטוח שתהנה מהעדכון החדש ותפיק ממנו את המירב." }),
      b("banner", { text: "הוראות הורדה והתקנה", color: "blue" }),
      b("paragraph", { text: "הורד את הקובץ התקנה מהקישורים למטה, והעתק ל-USB (בחוץ, לא בתוך תיקייה):\nקובץ: {{שם קובץ מקצבים}}" }),
      b("paragraph", { text: "לפני שאתה ניגש להתקנת המקצבים - נא למחוק את כל התיקיות שיש ב-USER.\nהתקן מקצבים (BUP).\nהתקן דגימות. נא לשים לב להשתמש להתקנת הדגימות רק עם דיסק און קי איכותי מברזל USB.3" }),
      b("paragraph", { text: "מצורף סרטון הסבר מלא לכל שלב ההתקנה." }),
      b("buttons", { buttons: [{ label: "דגימות", url: "{{samplesLink}}", color: "gold" }, { label: "מקצבים", url: "{{rhythmsLink}}", color: "gold" }] }),
      b("signature", {}),
    ],
  },

  // ===== מבצעים =====
  {
    name: "מבצע מיוחד",
    subject: "מבצע מיוחד — מוטי פלוס",
    category: "promotion",
    variables: ["fullName", "firstName"],
    blocks: [
      b("heading", { text: "מבצע מיוחד!" }),
      b("paragraph", { text: "שלום {{fullName}}," }),
      b("paragraph", { text: "(תוכן המבצע — ערוך כאן)" }),
      b("promo", { text: "הנחה מיוחדת לזמן מוגבל!", price: "", expiry: "" }),
      b("bankTable", {}),
      b("signature", {}),
    ],
  },

  // ===== לקוח חדש — סט שלם Tyros =====
  {
    name: "לקוח חדש — סט שלם Tyros",
    subject: "ברוך הבא למוטי פלוס!",
    category: "welcome",
    variables: ["fullName", "organ", "setType", "samplesLink", "rhythmsLink"],
    blocks: [
      b("heading", { text: "ברוכים הבאים!" }),
      b("paragraph", { text: "שלום {{fullName}}," }),
      b("paragraph", { text: "תודה רבה על הרכישה של {{setType}} לאורגן {{organ}}!\nאני בטוח שתהנה מהמקצבים והדגימות ותפיק מהם את המירב." }),
      b("banner", { text: "הוראות הורדה והתקנה", color: "blue" }),
      b("paragraph", { text: "הורד את הקבצים מהקישורים למטה והעתק ל-USB.\nתיקייה: HD1\nהתקן מקצבים (BUP).\nהתקן דגימות." }),
      b("buttons", { buttons: [{ label: "דגימות", url: "{{samplesLink}}", color: "gold" }, { label: "מקצבים", url: "{{rhythmsLink}}", color: "gold" }] }),
      b("signature", {}),
    ],
  },

  // ===== לקוח חדש — חצי סט Tyros =====
  {
    name: "לקוח חדש — חצי סט Tyros",
    subject: "ברוך הבא למוטי פלוס!",
    category: "welcome",
    variables: ["fullName", "organ", "setType", "samplesLink", "rhythmsLink"],
    blocks: [
      b("heading", { text: "ברוכים הבאים!" }),
      b("paragraph", { text: "שלום {{fullName}}," }),
      b("paragraph", { text: "תודה רבה שרכשת את החצי סט מקצבים.\nאני בטוח שתהנה ממנו ותפיק את המירב מכל המקצבים." }),
      b("paragraph", { text: "לידיעתך – בכל שלב תוכל לעדכן לסט המלא וליהנות ממאגר מקצבים מלא ואיכותי במיוחד, הכולל את כל הסגנונות." }),
      b("banner", { text: "הוראות הורדה והתקנה", color: "blue" }),
      b("paragraph", { text: "הורד את הקבצים מהקישורים למטה.\nהתקן מקצבים (BUP).\nהתקן דגימות.\nמצורף סרטון הסבר." }),
      b("buttons", { buttons: [{ label: "דגימות", url: "{{samplesLink}}", color: "gold" }, { label: "מקצבים", url: "{{rhythmsLink}}", color: "gold" }] }),
      b("signature", {}),
    ],
  },

  // ===== לקוח חדש — סט שלם Genos/920 =====
  {
    name: "לקוח חדש — סט שלם Genos/920",
    subject: "ברוך הבא למוטי פלוס!",
    category: "welcome",
    variables: ["fullName", "organ", "setType", "samplesLink", "rhythmsLink"],
    blocks: [
      b("heading", { text: "ברוכים הבאים!" }),
      b("paragraph", { text: "שלום {{fullName}}," }),
      b("paragraph", { text: "תודה רבה על הרכישה של {{setType}} לאורגן {{organ}}!\nאני בטוח שתהנה מהמקצבים והדגימות ותפיק מהם את המירב." }),
      b("banner", { text: "הוראות הורדה והתקנה", color: "blue" }),
      b("paragraph", { text: "הורד את הקובץ התקנה מהקישורים למטה, והעתק ל-USB.\nלפני ההתקנה - נא למחוק את כל התיקיות שיש ב-USER.\nהתקן מקצבים (BUP).\nהתקן דגימות." }),
      b("buttons", { buttons: [{ label: "דגימות", url: "{{samplesLink}}", color: "gold" }, { label: "מקצבים", url: "{{rhythmsLink}}", color: "gold" }] }),
      b("signature", {}),
    ],
  },

  // ===== לקוח חדש — חצי סט Genos/920 =====
  {
    name: "לקוח חדש — חצי סט Genos/920",
    subject: "ברוך הבא למוטי פלוס!",
    category: "welcome",
    variables: ["fullName", "organ", "setType", "samplesLink", "rhythmsLink"],
    blocks: [
      b("heading", { text: "ברוכים הבאים!" }),
      b("paragraph", { text: "שלום {{fullName}}," }),
      b("paragraph", { text: "תודה רבה שרכשת את החצי סט מקצבים.\nאני בטוח שתהנה ממנו ותפיק את המירב מכל המקצבים." }),
      b("paragraph", { text: "לידיעתך – בכל שלב תוכל לעדכן לסט המלא וליהנות ממאגר מקצבים מלא ואיכותי במיוחד, הכולל את כל הסגנונות." }),
      b("banner", { text: "הוראות הורדה והתקנה", color: "blue" }),
      b("paragraph", { text: "הורד את הקבצים מהקישורים למטה.\nלפני ההתקנה - נא למחוק את כל התיקיות שיש ב-USER.\nהתקן מקצבים (BUP).\nהתקן דגימות." }),
      b("buttons", { buttons: [{ label: "דגימות", url: "{{samplesLink}}", color: "gold" }, { label: "מקצבים", url: "{{rhythmsLink}}", color: "gold" }] }),
      b("signature", {}),
    ],
  },

  // ===== תבניות כלליות =====
  {
    name: "ברכת שנה חדשה",
    subject: "שנה טובה מצוות מוטי פלוס!",
    category: "general",
    variables: ["fullName", "firstName"],
    blocks: [
      b("heading", { text: "שנה טובה ומתוקה!" }),
      b("paragraph", { text: "שלום {{fullName}}," }),
      b("paragraph", { text: "מאחל לך שנה מלאה במוזיקה, בשמחה ובהשראה!\nשתהיה שנה של מקצבים חדשים, סאונד מושלם והמון הנאה מהאורגן!" }),
      b("signature", {}),
    ],
  },

  {
    name: "תזכורת — לא הוריד עדכון",
    subject: "תזכורת: העדכון שלך ממתין להורדה",
    category: "reminder",
    variables: ["fullName", "firstName", "updateVersion", "samplesLink"],
    blocks: [
      b("heading", { text: "תזכורת" }),
      b("paragraph", { text: "שלום {{fullName}}," }),
      b("paragraph", { text: "שמנו לב שעדיין לא הורדת את עדכון {{updateVersion}}.\nהקישורים להורדה עדיין פעילים — לחץ כדי להוריד:" }),
      b("buttons", { buttons: [{ label: "להורדת העדכון", url: "{{samplesLink}}", color: "blue" }] }),
      b("signature", {}),
    ],
  },
];

export { TEMPLATES as DEFAULT_EMAIL_TEMPLATES };

// POST /api/emails/templates/seed
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    let created = 0;
    let updated = 0;

    for (const t of TEMPLATES) {
      const body = blocksToHtml(t.blocks);

      const existing = await prisma.emailTemplate.findFirst({
        where: { name: t.name },
      });

      if (existing) {
        await prisma.emailTemplate.update({
          where: { id: existing.id },
          data: {
            body,
            subject: t.subject,
            variables: t.variables,
            category: t.category,
            blocks: JSON.parse(JSON.stringify(t.blocks)),
          },
        });
        updated++;
      } else {
        await prisma.emailTemplate.create({
          data: {
            name: t.name,
            subject: t.subject,
            body,
            category: t.category,
            variables: t.variables,
            blocks: JSON.parse(JSON.stringify(t.blocks)),
          },
        });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      total: TEMPLATES.length,
    });
  } catch (error) {
    console.error("Error seeding email templates:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תבניות" }, { status: 500 });
  }
}
