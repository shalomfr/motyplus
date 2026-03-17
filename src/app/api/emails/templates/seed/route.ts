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
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:12px;">
  <tr>
    <td align="right" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%;">
      עדכון {{updateVersion}}
    </td>
    <td align="left" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%; font-family:'Segoe UI', Arial, sans-serif;">
      Update
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:18px;">
  <tr>
    <td style="padding:14px; text-align:right; color:#124F90; border-bottom:1px solid #E3EAF6;">
      <p style="margin:0;">
        לקוח יקר, תודה רבה על רכישת <b>עדכון {{updateVersion}}</b>.<br>
        אני בטוח שתהנה מהעדכון החדש ותפיק ממנו את המירב.
      </p>
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="background:#EBF1F9; border:1px solid #C5D5EA; border-radius:12px;">
  <tr>
    <td style="padding:16px; text-align:right; color:#124F90;">
      <strong style="font-size:18px;">הוראות הורדה והתקנה:</strong><br><br>
      והפעם, במקביל למייל זה, יישלחו אליכם שני קישורים נפרדים עם הרשאות:<br><br>
      <strong>📍 <span style="text-decoration:underline;">קישור להורדת מקצבים</span></strong><br>
      <strong>📍 <span style="text-decoration:underline;">קישור להורדת דגימות</span></strong><br><br>
      יש להיכנס למיילים שהתקבלו, להוריד את הקבצים, ולאחר מכן לחלץ אותם לדיסק־און־קי (USB).<br><br>
      <strong>הקבצים היחידים שצריכים להיות על ה־USB לפני ההתקנה הם:</strong>
      <ul style="margin:8px 0 0 0; padding:0; list-style-type:none;">
        <li style="position:relative; padding-right:18px; margin-bottom:6px;">
          <span style="position:absolute; right:0; color:#124F90; font-weight:bold;">•</span>
          קובץ מקצבים של שם האורגן וסיומת: <strong>.bup</strong>
        </li>
        <li style="position:relative; padding-right:18px; margin-bottom:6px;">
          <span style="position:absolute; right:0; color:#124F90; font-weight:bold;">•</span>
          קובץ התקנת דגימות: <strong>.cpi</strong>
        </li>
      </ul>
      <br>
      <strong>הכנת הקבצים ל־USB:</strong><br>
      לאחר הורדת קובץ המקצבים, יש להעתיק לדיסק־און־קי בחוץ ולא בתוך תיקייה.<br><br>
      <strong>התקנה:</strong><br>
      התקן את קובץ המקצבים (<strong>BUP</strong>) ואת קובץ הדגימות.<br><br>
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
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:12px;">
  <tr>
    <td align="right" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%;">
      ברוכים הבאים!
    </td>
    <td align="left" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%; font-family:'Segoe UI', Arial, sans-serif;">
      Welcome
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px; margin-bottom:18px; background:#fdfdfe;">
  <tr>
    <td style="padding:18px; text-align:right;">
      <p style="margin:0; font-size:16px; line-height:1.75;">
        שלום <strong>{{fullName}}</strong>,<br><br>
        תודה רבה על הרכישה! 🙏<br><br>
        הסט שלך: <strong>{{setType}}</strong><br>
        אורגן: <strong>{{organ}}</strong><br><br>
        אני בטוח שתהנה מהמקצבים והדגימות ותפיק מהם את המירב.<br>
        בקרוב יישלחו אליך כל הקבצים והקישורים הנדרשים.<br><br>
        לכל שאלה ניתן לפנות אלי ישירות.
      </p>
    </td>
  </tr>
</table>

<div align="center" style="padding:10px 0;">
  <span style="display:inline-block; background:#124F90; color:#FFFFFF; font-size:16px; font-weight:bold; padding:10px 25px; border-radius:16px;">
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
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:12px;">
  <tr>
    <td align="right" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%;">
      יש עדכון חדש!
    </td>
    <td align="left" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%; font-family:'Segoe UI', Arial, sans-serif;">
      New Update
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px; margin-bottom:18px; background:#fdfdfe;">
  <tr>
    <td style="padding:18px; text-align:right;">
      <p style="margin:0; font-size:15px; line-height:1.75;">
        שלום <strong>{{fullName}}</strong>,<br><br>
        שמתי לב שאתה מעודכן לגרסה <strong>{{currentVersion}}</strong> ויש עדכון חדש שמחכה לך!<br><br>
        העדכון החדש כולל מגוון מקצבים חדשים, שדרוגי סאונד עמוקים, תוספות ושיפורים בכל סוגי הז'אנרים.
      </p>
    </td>
  </tr>
</table>

<div style="margin-top:20px; padding:20px; border:2px solid #124F90; border-radius:15px; background:#f9fbfd; text-align:center;">
  <strong style="font-size:19px;">עלות העדכון: {{remainingForFullSet}}</strong><br><br>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px; border-collapse:collapse; background:#ffffff;">
    <tr><td style="border:1px solid #D6E3F5; padding:10px; font-weight:bold; width:35%;">בנק</td><td style="border:1px solid #D6E3F5; padding:10px;">הפועלים (446)</td></tr>
    <tr><td style="border:1px solid #D6E3F5; padding:10px; font-weight:bold;">חשבון</td><td style="border:1px solid #D6E3F5; padding:10px;">113689</td></tr>
    <tr><td style="border:1px solid #D6E3F5; padding:10px; font-weight:bold;">שם</td><td style="border:1px solid #D6E3F5; padding:10px;">חוה גפנר</td></tr>
  </table>
  <div style="margin-top:15px; font-weight:bold; color:#d32f2f;">נא לשלוח אסמכתא לאחר ביצוע התשלום.</div>
</div>
`),
  },

  {
    name: "תזכורת — לא הוריד עדכון",
    subject: "תזכורת: העדכון שלך ממתין להורדה",
    category: "reminder",
    variables: ["fullName", "firstName", "updateVersion", "downloadLink"],
    body: wrapEmail(`
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:12px;">
  <tr>
    <td align="right" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%;">
      תזכורת
    </td>
    <td align="left" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%; font-family:'Segoe UI', Arial, sans-serif;">
      Reminder
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px; margin-bottom:18px;">
  <tr>
    <td style="padding:18px; text-align:right;">
      <p style="margin:0; font-size:15px; line-height:1.75;">
        שלום <strong>{{fullName}}</strong>,<br><br>
        שמנו לב שעדיין לא הורדת את עדכון <strong>{{updateVersion}}</strong>.<br><br>
        הקישורים להורדה עדיין פעילים — לחץ כדי להוריד:
      </p>
    </td>
  </tr>
</table>

<div align="center" style="padding:8px 0 18px;">
  <a href="{{downloadLink}}" style="display:inline-block; background:#124F90; color:#FFFFFF; font-size:16px; font-weight:bold; padding:10px 22px; border-radius:16px; text-decoration:none;">
    להורדת העדכון
  </a>
</div>
`),
  },

  {
    name: "טופס עדכון פרטים",
    subject: "עדכון פרטים — מוטי פלוס",
    category: "general",
    variables: ["fullName", "firstName"],
    body: wrapEmail(`
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:12px;">
  <tr>
    <td align="center" style="font-size:22px; font-weight:bold; color:#124F90;">
      עדכון פרטים
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px;">
  <tr>
    <td style="padding:18px; text-align:right;">
      <p style="margin:0; font-size:15px; line-height:1.75;">
        שלום <strong>{{fullName}}</strong>,<br><br>
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
  {
    name: "ברכת שנה חדשה",
    subject: "שנה טובה מצוות מוטי פלוס! 🎶",
    category: "general",
    variables: ["fullName", "firstName"],
    body: wrapEmail(`
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:12px;">
  <tr>
    <td align="center" style="font-size:24px; font-weight:bold; color:#124F90;">
      שנה טובה ומתוקה!
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px; margin-bottom:18px; background:#fdfdfe;">
  <tr>
    <td style="padding:20px; text-align:center;">
      <p style="margin:0; font-size:16px; line-height:2;">
        שלום <strong>{{fullName}}</strong>,<br><br>
        מאחל לך שנה מלאה במוזיקה, בשמחה ובהשראה!<br><br>
        שתהיה שנה של מקצבים חדשים, סאונד מושלם<br>
        והמון הנאה מהאורגן!<br><br>
        בברכה חמה,<br>
        <strong>מוטי פלוס</strong>
      </p>
    </td>
  </tr>
</table>

<div align="center" style="padding:8px 0;">
  <span style="display:inline-block; background:#124F90; color:#FFFFFF; font-size:18px; font-weight:bold; padding:10px 22px; border-radius:16px;">
    שנה טובה ומבורכת!
  </span>
</div>
`),
  },

  {
    name: "ברכת חג",
    subject: "חג שמח ממוטי פלוס!",
    category: "general",
    variables: ["fullName", "firstName"],
    body: wrapEmail(`
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:12px;">
  <tr>
    <td align="center" style="font-size:24px; font-weight:bold; color:#124F90;">
      חג שמח!
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px; margin-bottom:18px; background:#fdfdfe;">
  <tr>
    <td style="padding:20px; text-align:center;">
      <p style="margin:0; font-size:16px; line-height:2;">
        שלום <strong>{{fullName}}</strong>,<br><br>
        מאחלים לך ולמשפחתך חג שמח!<br>
        שיהיה מלא בשמחה, מוזיקה ורגעים טובים!<br><br>
        <strong>חג שמח!</strong><br>
        מוטי פלוס
      </p>
    </td>
  </tr>
</table>
`),
  },

  {
    name: "שליחת דגימות",
    subject: "קובץ דגימות חדש מוכן עבורך",
    category: "update",
    variables: ["fullName", "firstName", "organ", "downloadLink"],
    body: wrapEmail(`
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:12px;">
  <tr>
    <td align="right" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%;">
      דגימות חדשות
    </td>
    <td align="left" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%; font-family:'Segoe UI', Arial, sans-serif;">
      Samples
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px; margin-bottom:18px;">
  <tr>
    <td style="padding:14px; text-align:right;">
      <p style="margin:0; line-height:1.75;">
        שלום <strong>{{fullName}}</strong>,<br><br>
        קובץ הדגימות החדש שלך מוכן!<br><br>
        בהמשך למייל זה יישלח לך קישור להורדה עם הרשאות גישה.<br>
        יש להוריד ולהעתיק את קובץ ה-CPI לדיסק־און־קי ולהתקין באורגן.
      </p>
    </td>
  </tr>
</table>
`),
  },

  {
    name: "שליחת מקצבים ודגימות",
    subject: "עדכון מקצבים ודגימות חדש עבורך!",
    category: "update",
    variables: ["fullName", "firstName", "organ", "updateVersion", "downloadLink"],
    body: wrapEmail(`
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:12px;">
  <tr>
    <td align="right" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%;">
      עדכון {{updateVersion}}
    </td>
    <td align="left" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%; font-family:'Segoe UI', Arial, sans-serif;">
      Update
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px; margin-bottom:18px;">
  <tr>
    <td style="padding:14px; text-align:right;">
      <p style="margin:0; line-height:1.75;">
        שלום <strong>{{fullName}}</strong>,<br><br>
        העדכון <strong>{{updateVersion}}</strong> כולל מקצבים ודגימות חדשים!<br><br>
        בהמשך למייל זה יישלחו אליך קישורים להורדה:<br><br>
        <strong>📍 <span style="text-decoration:underline;">קישור להורדת מקצבים</span></strong> (.bup)<br>
        <strong>📍 <span style="text-decoration:underline;">קישור להורדת דגימות</span></strong> (.cpi)<br><br>
        יש להוריד, לחלץ ולהעתיק את שני הקבצים לדיסק־און־קי ולהתקין באורגן.
      </p>
    </td>
  </tr>
</table>
`),
  },

  {
    name: "הצעה לחצאי סטים",
    subject: "שדרג את הסט שלך — הצעה מיוחדת",
    category: "promotion",
    variables: ["fullName", "firstName", "organ", "setType", "remainingForFullSet"],
    body: wrapEmail(`
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:12px;">
  <tr>
    <td align="right" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%;">
      הצעה מיוחדת
    </td>
    <td align="left" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%; font-family:'Segoe UI', Arial, sans-serif;">
      Special Offer
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px; margin-bottom:18px; background:#fdfdfe;">
  <tr>
    <td style="padding:18px; text-align:right;">
      <p style="margin:0; font-size:15px; line-height:1.75;">
        שלום <strong>{{fullName}}</strong>,<br><br>
        שמנו לב שיש לך <strong>{{setType}}</strong> לאורגן <strong>{{organ}}</strong>.<br><br>
        עם שדרוג לסט שלם תקבל:
      </p>
      <ul style="margin:8px 0 0 0; padding:0; list-style-type:none;">
        <li style="position:relative; padding-right:18px; margin-bottom:6px;">
          <span style="position:absolute; right:0; color:#124F90; font-weight:bold;">•</span>
          עדכונים חינם למשך שנה
        </li>
        <li style="position:relative; padding-right:18px; margin-bottom:6px;">
          <span style="position:absolute; right:0; color:#124F90; font-weight:bold;">•</span>
          מגוון מקצבים רחב יותר
        </li>
        <li style="position:relative; padding-right:18px; margin-bottom:6px;">
          <span style="position:absolute; right:0; color:#124F90; font-weight:bold;">•</span>
          דגימות מותאמות אישית
        </li>
      </ul>
    </td>
  </tr>
</table>

<div style="margin-top:20px; padding:20px; border:2px solid #124F90; border-radius:15px; background:#f9fbfd; text-align:center;">
  <strong style="font-size:19px;">עלות השדרוג: {{remainingForFullSet}}</strong><br><br>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px; border-collapse:collapse; background:#ffffff;">
    <tr><td style="border:1px solid #D6E3F5; padding:10px; font-weight:bold; width:35%;">בנק</td><td style="border:1px solid #D6E3F5; padding:10px;">הפועלים (446)</td></tr>
    <tr><td style="border:1px solid #D6E3F5; padding:10px; font-weight:bold;">חשבון</td><td style="border:1px solid #D6E3F5; padding:10px;">113689</td></tr>
    <tr><td style="border:1px solid #D6E3F5; padding:10px; font-weight:bold;">שם</td><td style="border:1px solid #D6E3F5; padding:10px;">חוה גפנר</td></tr>
  </table>
  <div style="margin-top:15px; font-weight:bold; color:#d32f2f;">נא לשלוח אסמכתא לאחר ביצוע התשלום.</div>
</div>
`),
  },

  {
    name: "שליחת עדכון",
    subject: "עדכון {{updateVersion}} — מוטי פלוס",
    category: "update",
    variables: ["fullName", "firstName", "updateVersion", "organ", "downloadLink", "rhythmsLink"],
    body: wrapEmail(`
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:12px;">
  <tr>
    <td align="right" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%;">
      עדכון {{updateVersion}}
    </td>
    <td align="left" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%; font-family:'Segoe UI', Arial, sans-serif;">
      Update
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:18px;">
  <tr>
    <td style="padding:14px; text-align:right; color:#124F90; border-bottom:1px solid #E3EAF6;">
      <p style="margin:0;">
        שלום <strong>{{fullName}}</strong>,<br><br>
        העדכון החדש <strong>{{updateVersion}}</strong> מוכן עבורך!<br>
        בהמשך למייל זה יישלחו אליך קישורים להורדת הקבצים עם הרשאות גישה.
      </p>
    </td>
  </tr>
</table>
`),
  },

  {
    name: "ברכת קנייה",
    subject: "ברוך הבא למוטי פלוס!",
    category: "welcome",
    variables: ["customerName", "setType", "organName", "customerId"],
    body: wrapEmail(`
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:12px;">
  <tr>
    <td align="right" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%;">
      ברוכים הבאים!
    </td>
    <td align="left" class="title-cell" style="font-size:24px; font-weight:bold; color:#124F90; width:50%; font-family:'Segoe UI', Arial, sans-serif;">
      Welcome
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="border:1px solid #E3EAF6; border-radius:12px; margin-bottom:18px; background:#fdfdfe;">
  <tr>
    <td style="padding:18px; text-align:right;">
      <p style="margin:0; font-size:16px; line-height:1.75;">
        שלום <strong>{{customerName}}</strong>,<br><br>
        תודה על הרכישה של <strong>{{setType}}</strong> לאורגן <strong>{{organName}}</strong>!<br>
        מספר הלקוח שלך: <strong>{{customerId}}</strong><br><br>
        בקרוב יישלחו אליך כל הקבצים הנדרשים.<br>
        לכל שאלה — כאן בשבילך!<br><br>
        בברכה,<br>
        <strong>מוטי פלוס</strong>
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
