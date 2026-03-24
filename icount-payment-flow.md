# iCount Payment Flow — תיעוד מלא (2026-03-22)

iCount הוא ספק התשלום הפעיל עבור טופס ההזמנה הציבורי. Stripe הוא legacy.

## ארכיטקטורה

```
motyplus-order (frontend)          →  motyroz CRM (backend)                →  iCount API
https://motyplus-order.onrender.com   https://motyplus-2hvb.onrender.com     https://api.icount.co.il/api/v3.php
```

- **motyplus-order**: אפליקציית Next.js קלה, מעבירה את כל הקריאות ל-CRM דרך proxy
- **Proxy route**: `src/app/api/public/[...path]/route.ts` → `https://motyplus-2hvb.onrender.com`
- **CRM מטפל ב**: בחירת ספק חיוב, יצירת דף תשלום, עיבוד webhook

## קבצים מרכזיים

| קובץ | תפקיד |
|------|---------|
| `src/lib/icount/client.ts` | `ICountClient` — login, תשלומים, מסמכים, דפי סליקה |
| `src/lib/icount/types.ts` | TypeScript types עבור iCount API |
| `src/lib/billing/icount-adapter.ts` | מתאם ICountClient לממשק `BillingClient` האחיד |
| `src/lib/billing/get-client.ts` | בוחר ספק חיוב ראשי מה-DB |
| `src/app/api/public/create-payment/route.ts` | יוצר PendingOrder + דף תשלום iCount |
| `src/app/api/webhooks/icount/route.ts` | Webhook handler + `processCompletedOrder()` |
| `src/app/api/public/process-icount-success/route.ts` | Fallback: מעבד תשלום מפרמטרי URL של דף ההצלחה |
| `src/app/(public)/order/success/page.tsx` | דף הצלחה שמוצג אחרי תשלום |
| `src/app/(public)/order/success/process-payment.tsx` | קומפוננטה שקוראת ל-fallback API |
| `src/app/(public)/order/cancel/page.tsx` | דף ביטול/כישלון |

## זרימת תשלום

1. לקוח ממלא טופס הזמנה ב-`motyplus-order`
2. Frontend שולח `POST /api/public/create-payment` (FormData עם קובץ info)
3. CRM בוחר ספק חיוב ראשי (`getBillingClient()` → שאילתה `isPrimary: true`)
4. CRM יוצר רשומת `PendingOrder` (שומר קובץ info כ-bytes)
5. `ICountAdapter.createPaymentPage()` קורא ל-iCount API `paypage/create`
6. מחזיר URL לדף תשלום (למשל `https://app.icount.co.il/m/xxxxx`)
7. לקוח מועבר לדף התשלום של iCount
8. אחרי תשלום:
   - iCount שולח IPN webhook ל-`/api/webhooks/icount`
   - לקוח מועבר ל-`/order/success` עם נתוני תשלום ב-URL
   - קומפוננטת דף ההצלחה קוראת ל-`/api/public/process-icount-success` כ-fallback
9. `processCompletedOrder()` יוצר Customer (PENDING_APPROVAL) + Payment + מעלה info file לגוגל דרייב

## פרטי iCount API

### אימות
- Bearer token: `API3E8-C0A82A0C-69BA0276-273FA7D7DD59B3A2`
- נשלח כ-`Authorization: Bearer TOKEN` בהדר
- Credentials מוצפנים בטבלת `BillingProvider`

### יצירת דף תשלום (`paypage/create`)
- פריטים משתמשים במפתחות `desc`, `quantity`, `unitprice` (לא פורמט `description_1`)
- שולח גם `cs` (custom sum) ו-`cd` (custom description) כ-fallback
- שדות לקוח: גם `client_name`/`email`/`phone` וגם `full_name`/`contact_email`/`contact_phone`
- כתובות: `success_url`, `failure_url`, `cancel_url`, `ipn_url`, `webhook_url`
- מסמך: `auto_create_doc: 1`, `doctype: "invrec"` (חשבונית מס-קבלה)

### Workaround למע"מ
- iCount **תמיד** מוסיף 18% מע"מ — אין פרמטר API שמבטל את זה
- פרמטרים שנוסו ולא עבדו: `vat_exempt`, `include_vat`, `no_vat`, `vat_percent`, `price_include_vat`, `vat_type`
- **פתרון**: מחלקים את unitprice ב-1.18 לפני השליחה, ככה שהסכום הסופי כולל מע"מ = המחיר המקורי
- דוגמה: 9,500 / 1.18 = 8,050.85 → + 18% מע"מ = 9,500 ₪
- כדי להשבית מע"מ לגמרי: לשנות הגדרות חשבון iCount ל"עוסק פטור"

### העברת Metadata (קידומת m__)
- פרמטר `custom_fields` הוצג כשדה גלוי בטופס "פרטים נוספים" — בעייתי
- **פתרון**: שימוש בקידומת `m__` לשדות מוסתרים
- נשלח: `m__pendingOrderId`, `m__promotionId`
- iCount מחזיר אותם ב-IPN ללא קידומת `m__` (כ-`pendingOrderId`)
- מוחזרים גם בפרמטרי URL של redirect לדף ההצלחה

### בעיית "המכירה נסגרה"
- דף התשלום הציג "המכירה נסגרה" כשהשתמשנו בפורמט `description_1`/`quantity_1`/`unitprice_1`
- תוקן על ידי מעבר למערך `items` עם מפתחות `desc`/`quantity`/`unitprice`
- לא להגדיר `max_payments` — להשאיר ריק לשימוש ללא הגבלה

## Webhook Handler

### קבלת נתונים
מקבל JSON וגם form-encoded POST data (iCount עשוי לשלוח אחד מהם)
- `parseRequestBody()` בודק Content-Type ומטפל בשני הפורמטים

### אימות (אופציונלי, נשלט ע"י `ICOUNT_WEBHOOK_SECRET`)
- Query param `?secret=` (מצורף ע"י create-payment route)
- הדר `Authorization: Bearer`
- הדר `X-iCount-Signature`
- אם משתנה סביבה לא מוגדר → webhook פתוח (ללא אימות)

### חילוץ Metadata (תמיכה במספר פורמטים)
1. שדות ישירים: `pendingOrderId` (iCount מסיר קידומת `m__`)
2. עם קידומת `m__`: `m__pendingOrderId` (אם iCount לא מסיר)
3. מחרוזת JSON `custom_fields`
4. פורמט `custom[{json}]` כ-key (legacy)

### בדיקת סטטוס
iCount IPN נשלח רק בהצלחה, אבל הקוד גם בודק שדה `status` אם קיים.

## יצירת לקוח (`processCompletedOrder`)

יוצר:
- **Customer** עם סטטוס `PENDING_APPROVAL` (ממתין לאישור)
- **Payment** record (COMPLETED, paymentMethod: "ICOUNT")
- **Info file** מועלה לגוגל דרייב (`customers/info/{customerId}.n27`)
- **Activity log** entry (action: CREATE, source: icount_payment)
- מסמן **PendingOrder** כ-COMPLETED

**Idempotent**: בודק `pendingOrder.status !== "PENDING"` לפני עיבוד.

## הזמנת לקוח (Invite Customer)

- כפתור בדף הבית + דף לקוחות
- דיאלוג: שם + מייל → שולח מייל HTML מעוצב דרך SMTP2GO
- המייל כולל קישור ל-`https://motyplus-order.onrender.com`
- API: `POST /api/public/invite-customer`

## משתני סביבה

| משתנה | תפקיד |
|-------|---------|
| `ICOUNT_WEBHOOK_SECRET` | סוד webhook אופציונלי |
| `SMTP2GO_API_KEY` | שליחת מיילים |
| `SMTP_USER` | כתובת שולח (ברירת מחדל: beats@mottirozenfeld.com) |
