import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const SEED_TASKS = [
  // ===== הושלם (DONE) =====
  { title: "הוספת לקוח חדש — כל השדות + אורגן + סט", category: "לקוחות", status: "DONE", priority: "HIGH" },
  { title: "עריכת לקוח מלאה — כל השדות ניתנים לעריכה", category: "לקוחות", status: "DONE", priority: "HIGH" },
  { title: "רשימת לקוחות עם חיפוש, פילטרים וייצוא לאקסל", category: "לקוחות", status: "DONE", priority: "HIGH" },
  { title: "העלאת קובץ אינפו + הורדה מכרטיס לקוח", category: "לקוחות", status: "DONE", priority: "HIGH" },
  { title: "אורגן מקושר — תמיכה בשני אורגנים ללקוח", category: "לקוחות", status: "DONE", priority: "MEDIUM" },
  { title: "שדרוג לסט שלם — כפתור ירוק בכרטיס לקוח", category: "לקוחות", status: "DONE", priority: "MEDIUM" },
  { title: "חסימה / הקפאה / חריג — סטטוסים ללקוח", category: "לקוחות", status: "DONE", priority: "MEDIUM" },
  { title: "מזהה לקוח אוטומטי", category: "לקוחות", status: "DONE", priority: "LOW" },
  { title: "תאריך רכישה אוטומטי + תפוגת עדכון שנה", category: "לקוחות", status: "DONE", priority: "MEDIUM" },
  { title: "סכום ששולם לפי סוג סט", category: "לקוחות", status: "DONE", priority: "MEDIUM" },
  { title: "גרסאות עדכון — יצירה, סטטוסים, מחירים", category: "עדכונים", status: "DONE", priority: "HIGH" },
  { title: "סטטוס עדכון: טיוטה → הכנה → מוכן → שליחה → הושלם", category: "עדכונים", status: "DONE", priority: "HIGH" },
  { title: "העלאת קבצי עדכון (מקצבים, דגימות, ZIP)", category: "עדכונים", status: "DONE", priority: "HIGH" },
  { title: "שליחת עדכון ללקוח בודד", category: "עדכונים", status: "DONE", priority: "HIGH" },
  { title: "צינור לידים — חדש → שיחה → הצעה → סגירה", category: "לידים", status: "DONE", priority: "HIGH" },
  { title: "המרת ליד ללקוח", category: "לידים", status: "DONE", priority: "MEDIUM" },
  { title: "הערות לליד — CRUD", category: "לידים", status: "DONE", priority: "LOW" },
  { title: "קודי קופון — הנחות, תוקף, מגבלת שימוש", category: "מבצעים", status: "DONE", priority: "HIGH" },
  { title: "תבניות מייל לפי קטגוריה (עדכון, ברכה, מבצע)", category: "מיילים", status: "DONE", priority: "HIGH" },
  { title: "משתנים דינמיים בתבניות מייל", category: "מיילים", status: "DONE", priority: "MEDIUM" },
  { title: "ניהול אורגנים — CRUD + תמיכה בעדכונים", category: "נתונים", status: "DONE", priority: "HIGH" },
  { title: "ניהול סוגי סטים — מחירים + תמיכה בעדכונים", category: "נתונים", status: "DONE", priority: "HIGH" },
  { title: "חיבור Google Drive — אחסון קבצים", category: "הגדרות", status: "DONE", priority: "HIGH" },
  { title: "חיבור WhatsApp — QR / זיווג טלפון", category: "הגדרות", status: "DONE", priority: "MEDIUM" },
  { title: "גיבוי ושחזור — ייצוא/ייבוא JSON", category: "הגדרות", status: "DONE", priority: "HIGH" },
  { title: "ניהול משתמשים — הוספה, הפעלה, תפקידים", category: "הגדרות", status: "DONE", priority: "HIGH" },
  { title: "יומן פעילות — לוג מלא עם פילטרים", category: "לוח בקרה", status: "DONE", priority: "HIGH" },
  { title: "גרף הכנסות בדשבורד", category: "לוח בקרה", status: "DONE", priority: "MEDIUM" },
  { title: "כרטיסי סטטיסטיקות בדשבורד", category: "דף הבית", status: "DONE", priority: "MEDIUM" },
  { title: "קוביות קיצורי דרך — 8 כפתורים + הורדת אינפו", category: "דף הבית", status: "DONE", priority: "LOW" },
  { title: "פעילות אחרונה בדשבורד", category: "לוח בקרה", status: "DONE", priority: "LOW" },
  { title: "התראת לקוחות שצריכים עדכון", category: "דף הבית", status: "DONE", priority: "MEDIUM" },

  // ===== בתכנון / בביצוע (PLANNING / IN_PROGRESS) =====
  { title: "UI שליחה המונית של מיילים — בחירת נמענים + שליחה", category: "מיילים", status: "PLANNING", priority: "HIGH" },
  { title: "רשימת עבודה ייעודית לעדכונים — לפי אורגן", category: "עדכונים", status: "PLANNING", priority: "HIGH" },
  { title: "מעקב הורדות — מי הוריד ומי לא", category: "עדכונים", status: "PLANNING", priority: "MEDIUM" },
  { title: "תצוגה מקדימה למייל לפני שליחה", category: "מיילים", status: "PLANNING", priority: "MEDIUM" },
  { title: "שליחת עדכון לכולם בלחיצה אחת", category: "עדכונים", status: "IN_PROGRESS", priority: "HIGH" },

  // ===== רעיונות (IDEA) =====
  { title: "תפריט שליחות — 8 אפשרויות שליחה ללקוח", category: "לקוחות", status: "IDEA", priority: "HIGH", description: "מייל ברכה, מקצבים בלבד, דגימות בלבד, מקצבים+דגימות, הוראות, מייל חופשי, טופס עדכון פרטים, הצעת מחיר ליתרה" },
  { title: "לקוח מזדמן — סימון לקוח שלא בעדכונים", category: "לקוחות", status: "IDEA", priority: "MEDIUM", description: "הכל אותו דבר אבל הוא לא ברשימת העדכונים, עם אפשרות להכניס אותו לעדכונים" },
  { title: "זיהוי אורגן אוטומטי מקובץ אינפו", category: "לקוחות", status: "IDEA", priority: "MEDIUM", description: "כשמעלים אינפו, המערכת מזהה אוטומטית את סוג האורגן מתוך הקובץ" },
  { title: "עמלות סוכן — מעקב אחוזים על עסקאות", category: "לידים", status: "IDEA", priority: "LOW", description: "כמה כסף הסוכן צריך לקבל לפי אחוזים על כל עסקה שנסגרה" },
  { title: "מעקב הוצאות — הוצאות לעומת הכנסות", category: "לוח בקרה", status: "IDEA", priority: "LOW" },
  { title: "תזכורת אוטומטית למי שלא הוריד עדכון", category: "מיילים", status: "IDEA", priority: "MEDIUM", description: "מייל תזכורת אוטומטי לאחר X ימים למי שלא הוריד" },
  { title: "סקר ללקוחות + קופון למי שענה", category: "מיילים", status: "IDEA", priority: "LOW" },
  { title: "חוזה דיגיטלי לחתימה", category: "מיילים", status: "IDEA", priority: "LOW" },
  { title: "אינטגרציית טלפון — זיהוי מתקשר + פרטים", category: "לידים", status: "IDEA", priority: "LOW", description: "מי שמתקשר לפון עובר דרך המערכת ועולים לו הפרטים" },
  { title: "קישור סליקה מותאם — קישור תשלום ללקוח", category: "מבצעים", status: "IDEA", priority: "MEDIUM" },
  { title: "ניוזלטר — שליחת עדכונים תקופתיים", category: "מיילים", status: "IDEA", priority: "LOW" },
  { title: "שליחת עדכון קטן — מקצבים בודדים בנפרד", category: "עדכונים", status: "IDEA", priority: "MEDIUM", description: "כשיוצא עדכון קטן של מקצבים בודדים, לשלוח בנפרד למי שכבר מעודכן" },
  { title: "שליחת מיילים לפי סינון — למי שלא מעודכן עם מחירון", category: "מיילים", status: "IDEA", priority: "HIGH", description: "שליחת מייל ללא-מעודכנים עם כמה עולה להשלים + כמה עדכונים חסרים" },
  { title: "שליחת קישור העלאת אינפו ללקוח", category: "לקוחות", status: "IDEA", priority: "MEDIUM" },
  { title: "כפתור שליחת אינפו למישהו אחר", category: "לקוחות", status: "IDEA", priority: "LOW" },
  { title: "שליחת ווטסאפ — ברכות ועדכונים", category: "לקוחות", status: "IDEA", priority: "MEDIUM" },
  { title: "הצגת המייל לפני שליחה — אישור איך ייראה", category: "מיילים", status: "IDEA", priority: "MEDIUM" },
  { title: "התאמת טקסט ספציפי לאדם מסוים ושליחה", category: "מיילים", status: "IDEA", priority: "LOW" },
  { title: "שליחה מוקדמת לקבוצת מיקוד", category: "מיילים", status: "IDEA", priority: "LOW" },
  { title: "עיצוב קבוע למיילים עם לוגו ואנימציה", category: "מיילים", status: "IDEA", priority: "MEDIUM" },
  { title: "הכנת תיקיות אוטומטית בפתיחת עדכון חדש", category: "עדכונים", status: "IDEA", priority: "HIGH", description: "בפתיחת עדכון חדש, נפתחות אוטומטית כל התיקיות (לכל אורגן, לכל סט) מוכנות למילוי" },
  { title: "רובוט — אוטומציה של Expansion Manager", category: "עדכונים", status: "DONE", priority: "HIGH", description: "רובוט שלוקח מזהה, נכנס לתוכנה, מכין סימונים ושומר CPI" },
  { title: "ייצוא רשימות מסוננות לאקסל", category: "לקוחות", status: "IDEA", priority: "LOW" },
  { title: "סימון דגימות למחשב (CPF במקום CPI)", category: "לקוחות", status: "DONE", priority: "MEDIUM" },
  { title: "מעקב מי קיבל עדכון בזמן האחרון", category: "לוח בקרה", status: "IDEA", priority: "MEDIUM" },
  { title: "יומן פעילות — תיעוד רכישות, עדכונים, תשלומים", category: "לוח בקרה", status: "DONE", priority: "HIGH" },
  { title: "החלפת אורגן — כפתור שמחליף מספר אינפו", category: "לקוחות", status: "IDEA", priority: "LOW" },
  { title: "הפיכת לקוח ללא פעיל עקב מכירת אורגן", category: "לקוחות", status: "DONE", priority: "LOW" },
]

// POST /api/tasks/seed - טעינת משימות ראשונית מהאפיון
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    // בדוק אם כבר יש משימות
    const existing = await prisma.task.count();
    if (existing > 0) {
      return NextResponse.json(
        { error: "כבר קיימות משימות במערכת. מחק אותן קודם אם רוצה לטעון מחדש.", count: existing },
        { status: 409 }
      );
    }

    // צור את כל המשימות
    const tasks = await prisma.task.createMany({
      data: SEED_TASKS.map((t, i) => ({
        title: t.title,
        description: t.description || null,
        status: t.status as "IDEA" | "PLANNING" | "IN_PROGRESS" | "DONE",
        priority: (t.priority || "MEDIUM") as "LOW" | "MEDIUM" | "HIGH",
        category: t.category,
        order: i,
        completedAt: t.status === "DONE" ? new Date() : null,
      })),
    });

    return NextResponse.json({
      success: true,
      count: tasks.count,
      message: `נטענו ${tasks.count} משימות מהאפיון`,
    });
  } catch (error) {
    console.error("Error seeding tasks:", error);
    return NextResponse.json({ error: "שגיאה בטעינת משימות" }, { status: 500 });
  }
}
