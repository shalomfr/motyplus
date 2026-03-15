import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// תבנית בסיס — wrapper חיצוני לכל המיילים
function wrapEmail(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
@media only screen and (max-width: 600px) {
  .container { width: 100% !important; border-radius: 0 !important; }
  .content-padding { padding: 12px !important; }
  .title-cell { font-size: 18px !important; }
}
</style>
</head>
<body style="margin:0; padding:0; background:#EEF3FB; font-family:Arial, Helvetica, sans-serif; color:#124F90;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#EEF3FB" dir="rtl">
<tr><td align="center" style="padding:10px;">
<table class="container" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background:#FFFFFF; border-radius:14px; overflow:hidden;">
<tr><td class="content-padding" style="padding:20px; font-size:14px; line-height:1.75; color:#124F90; text-align:right;">

<div style="font-size:12px; margin-bottom:10px; font-weight:bold; color:#8fa3b9;">בס"ד</div>

${bodyContent}

<div style="margin-top:25px; padding-top:15px; border-top:1px solid #E3EAF6; text-align:center; font-size:12px; color:#8fa3b9;">
  מוטי פלוס | מקצבים ודגימות לאורגנים
</div>

</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const TEMPLATES = [
  {
    name: "עדכון חדש — ללקוח מעודכן",
    subject: "עדכון {{updateVersion}} מוכן עבורך!",
    category: "update",
    variables: ["fullName", "firstName", "updateVersion", "organ", "downloadLink", "downloadLink2", "additionalOrganName", "additionalOrganLine"],
    body: wrapEmail(`
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:15px;">
  <tr>
    <td align="right" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%;">
      עדכון <span data-var="updateVersion" style="background:#fff3e0;color:#e65100;padding:2px 10px;border-radius:12px;font-weight:600;font-size:20px;">{{updateVersion}}</span>
    </td>
    <td align="left" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%; font-family:Arial;">
      Update
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px; margin-bottom:18px;">
  <tr>
    <td style="padding:14px; text-align:right;">
      <p style="margin:0;">
        שלום <strong><span data-var="fullName" style="background:#fff3e0;color:#e65100;padding:2px 10px;border-radius:12px;font-weight:600;">{{fullName}}</span></strong>,<br><br>
        העדכון החדש מוכן עבורך! 🎹<br>
        בהמשך למייל זה יישלחו אליך קישורים להורדת הקבצים עם הרשאות גישה.
      </p>
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="background:#EBF1F9; border:1px solid #C5D5EA; border-radius:12px;">
  <tr>
    <td style="padding:16px; text-align:right; color:#124F90;">
      <strong style="font-size:18px;">הוראות הורדה והתקנה:</strong><br><br>
      במקביל למייל זה, יישלחו אליכם שני קישורים נפרדים עם הרשאות:<br><br>
      <strong>📍 <span style="text-decoration:underline;">קישור להורדת מקצבים</span></strong><br>
      <strong>📍 <span style="text-decoration:underline;">קישור להורדת דגימות</span></strong><br><br>
      יש להיכנס למיילים שהתקבלו, להוריד את הקבצים, ולאחר מכן לחלץ אותם לדיסק־און־קי (USB).<br><br>
      <strong>הקבצים שצריכים להיות על ה-USB:</strong>
      <ul style="margin:8px 0 0 0; padding:0; list-style-type:none;">
        <li style="position:relative; padding-right:18px; margin-bottom:6px;">
          <span style="position:absolute; right:0; color:#124F90; font-weight:bold;">•</span>
          קובץ מקצבים בסיומת: <strong>.bup</strong>
        </li>
        <li style="position:relative; padding-right:18px; margin-bottom:6px;">
          <span style="position:absolute; right:0; color:#124F90; font-weight:bold;">•</span>
          קובץ דגימות: <strong>.cpi</strong>
        </li>
      </ul>
      <br>
      <strong>התקנה:</strong><br>
      התקן את קובץ המקצבים (BUP) ואת קובץ הדגימות (CPI).<br><br>
      מצורף סרטון הסבר מלא לכל שלבי ההתקנה.
    </td>
  </tr>
</table>
`),
  },

  {
    name: "ברכה לאחר רכישה",
    subject: "ברוך הבא למשפחת מוטי פלוס! 🎹",
    category: "welcome",
    variables: ["fullName", "firstName", "organ", "setType"],
    body: wrapEmail(`
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:15px;">
  <tr>
    <td align="center" style="font-size:24px; font-weight:bold; color:#124F90;">
      ברוכים הבאים למשפחת מוטי פלוס!
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px; margin-bottom:18px; background:#fdfdfe;">
  <tr>
    <td style="padding:18px; text-align:right;">
      <p style="margin:0; font-size:16px;">
        שלום <strong><span data-var="fullName" style="background:#fff3e0;color:#e65100;padding:2px 10px;border-radius:12px;font-weight:600;">{{fullName}}</span></strong>,<br><br>
        תודה רבה על הרכישה! 🙏<br><br>
        הסט שלך: <strong><span data-var="setType" style="background:#fff3e0;color:#e65100;padding:2px 10px;border-radius:12px;font-weight:600;">{{setType}}</span></strong><br>
        אורגן: <strong><span data-var="organ" style="background:#fff3e0;color:#e65100;padding:2px 10px;border-radius:12px;font-weight:600;">{{organ}}</span></strong><br><br>
        אני בטוח שתהנה מהמקצבים והדגימות ותפיק מהם את המירב.<br>
        בקרוב יישלחו אליך כל הקבצים והקישורים הנדרשים.<br><br>
        לכל שאלה ניתן לפנות אלי ישירות.
      </p>
    </td>
  </tr>
</table>

<div align="center" style="padding:10px 0;">
  <span style="display:inline-block; background:#124F90; color:#FFFFFF; font-size:16px; font-weight:bold; padding:10px 25px; border-radius:20px;">
    בהצלחה ובהנאה! 🎵
  </span>
</div>
`),
  },

  {
    name: "הצעת מחיר — למי שלא מעודכן",
    subject: "עדכון חדש ממתין לך — הצעה מיוחדת",
    category: "promotion",
    variables: ["fullName", "firstName", "organ", "currentVersion", "remainingAmount", "remainingForFullSet"],
    body: wrapEmail(`
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:15px;">
  <tr>
    <td align="center" style="font-size:24px; font-weight:bold; color:#124F90;">
      יש עדכון חדש! 🎹
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px; margin-bottom:18px; background:#fdfdfe;">
  <tr>
    <td style="padding:18px; text-align:right;">
      <p style="margin:0; font-size:15px;">
        שלום <strong><span data-var="fullName" style="background:#fff3e0;color:#e65100;padding:2px 10px;border-radius:12px;font-weight:600;">{{fullName}}</span></strong>,<br><br>
        שמתי לב שאתה מעודכן לגרסה <span data-var="currentVersion" style="background:#fff3e0;color:#e65100;padding:2px 10px;border-radius:12px;font-weight:600;">{{currentVersion}}</span> ויש עדכון חדש שמחכה לך!<br><br>
        העדכון החדש כולל מגוון מקצבים חדשים, שדרוגי סאונד ותוספות משמעותיות.
      </p>
    </td>
  </tr>
</table>

<div style="margin:20px 0; padding:20px; border:2px solid #124F90; border-radius:15px; background:#f9fbfd; text-align:center;">
  <strong style="font-size:18px;">עלות השדרוג: <span data-var="remainingForFullSet" style="background:#fff3e0;color:#e65100;padding:2px 10px;border-radius:12px;font-weight:600;">{{remainingForFullSet}}</span></strong><br><br>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px; border-collapse:collapse; background:#fff;">
    <tr><td style="border:1px solid #D6E3F5; padding:8px; font-weight:bold; width:30%;">בנק</td><td style="border:1px solid #D6E3F5; padding:8px;">הפועלים (446)</td></tr>
    <tr><td style="border:1px solid #D6E3F5; padding:8px; font-weight:bold;">חשבון</td><td style="border:1px solid #D6E3F5; padding:8px;">113689</td></tr>
    <tr><td style="border:1px solid #D6E3F5; padding:8px; font-weight:bold;">שם</td><td style="border:1px solid #D6E3F5; padding:8px;">חוה גפנר</td></tr>
  </table>
  <div style="margin-top:10px; font-weight:bold; color:#d32f2f;">נא לשלוח אסמכתא לאחר ביצוע התשלום.</div>
</div>
`),
  },

  {
    name: "תזכורת — לא הוריד עדכון",
    subject: "תזכורת: העדכון שלך ממתין להורדה",
    category: "reminder",
    variables: ["fullName", "firstName", "updateVersion", "downloadLink"],
    body: wrapEmail(`
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:15px;">
  <tr>
    <td align="center" style="font-size:22px; font-weight:bold; color:#124F90;">
      ⏰ תזכורת — העדכון ממתין להורדה
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px; margin-bottom:18px;">
  <tr>
    <td style="padding:18px; text-align:right;">
      <p style="margin:0; font-size:15px;">
        שלום <strong><span data-var="fullName" style="background:#fff3e0;color:#e65100;padding:2px 10px;border-radius:12px;font-weight:600;">{{fullName}}</span></strong>,<br><br>
        שמנו לב שעדיין לא הורדת את עדכון <span data-var="updateVersion" style="background:#fff3e0;color:#e65100;padding:2px 10px;border-radius:12px;font-weight:600;">{{updateVersion}}</span>.<br><br>
        הקישורים להורדה עדיין פעילים — לחץ כדי להוריד:<br><br>
        <a href="{{downloadLink}}" style="display:inline-block; background:#124F90; color:#FFFFFF; padding:10px 20px; border-radius:8px; text-decoration:none; font-weight:bold;">
          להורדת העדכון
        </a>
      </p>
    </td>
  </tr>
</table>
`),
  },

  {
    name: "טופס עדכון פרטים",
    subject: "עדכון פרטים — מוטי פלוס",
    category: "general",
    variables: ["fullName", "firstName"],
    body: wrapEmail(`
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:15px;">
  <tr>
    <td align="center" style="font-size:22px; font-weight:bold; color:#124F90;">
      עדכון פרטים
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px;">
  <tr>
    <td style="padding:18px; text-align:right;">
      <p style="margin:0; font-size:15px;">
        שלום <strong><span data-var="fullName" style="background:#fff3e0;color:#e65100;padding:2px 10px;border-radius:12px;font-weight:600;">{{fullName}}</span></strong>,<br><br>
        נשמח אם תעדכן את הפרטים שלך כדי שנוכל לתת לך את השירות הטוב ביותר.<br><br>
        אנא מלא את הפרטים הבאים ושלח אותם בחזרה:<br><br>
        <strong>שם מלא:</strong> _______________<br>
        <strong>טלפון:</strong> _______________<br>
        <strong>מייל:</strong> _______________<br>
        <strong>כתובת:</strong> _______________<br>
        <strong>סוג אורגן:</strong> _______________<br><br>
        תודה רבה! 🙏
      </p>
    </td>
  </tr>
</table>
`),
  },
];

export { TEMPLATES as DEFAULT_EMAIL_TEMPLATES };

// POST /api/emails/templates/seed — טעינת תבניות מעוצבות
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    let created = 0;
    let skipped = 0;

    for (const t of TEMPLATES) {
      const existing = await prisma.emailTemplate.findFirst({
        where: { name: t.name },
      });
      if (existing) {
        // עדכון תוכן בלבד
        await prisma.emailTemplate.update({
          where: { id: existing.id },
          data: { body: t.body, subject: t.subject, variables: t.variables },
        });
        skipped++;
        continue;
      }

      await prisma.emailTemplate.create({
        data: {
          name: t.name,
          subject: t.subject,
          body: t.body,
          category: t.category,
          variables: t.variables,
        },
      });
      created++;
    }

    return NextResponse.json({
      success: true,
      created,
      updated: skipped,
      total: TEMPLATES.length,
    });
  } catch (error) {
    console.error("Error seeding email templates:", error);
    return NextResponse.json({ error: "שגיאה בטעינת תבניות" }, { status: 500 });
  }
}
