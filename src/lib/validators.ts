import { z } from "zod";

// ===== לקוחות =====

const emptyToNull = z.string().optional().nullable().transform(v => v === '' ? null : v ?? null);

export const customerSchema = z.object({
  fullName: z.string().min(2, "שם חייב להכיל לפחות 2 תווים").max(100, "שם ארוך מדי"),
  phone: z.string().min(9, "מספר טלפון לא תקין"),
  whatsappPhone: emptyToNull,
  address: emptyToNull,
  email: z.string().email("כתובת מייל לא תקינה"),
  organId: emptyToNull,
  additionalOrganId: emptyToNull,
  setTypeId: z.string().min(1, "יש לבחור סוג סט"),
  customerId: emptyToNull,
  amountPaid: z.number().min(0, "סכום לא תקין"),
  discountReason: emptyToNull,
  purchaseDate: z.string().optional(),
  notes: emptyToNull,
  infoFileUrl: emptyToNull,
  additionalInfoFileUrl: emptyToNull,
});

export const customerUpdateSchema = customerSchema.partial().extend({
  status: z.enum(["PENDING_APPROVAL", "ACTIVE", "BLOCKED", "FROZEN", "EXCEPTION"]).optional(),
  sampleType: z.enum(["CPI", "CPF"]).optional(),
  currentUpdateVersion: z.string().optional().nullable(),
  hasV3: z.boolean().optional(),
  isCasual: z.boolean().optional(),
});

// ===== לידים =====

export const leadSchema = z.object({
  fullName: z.string().min(2, "שם חייב להכיל לפחות 2 תווים").max(100, "שם ארוך מדי"),
  phone: z.string().min(9, "מספר טלפון לא תקין"),
  email: z.string().email("כתובת מייל לא תקינה").optional().nullable(),
  organId: z.string().optional().nullable(),
  organInterest: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  stage: z.enum(["NEW", "CONTACTED", "PROPOSAL", "CLOSED_WON", "CLOSED_LOST"]).optional(),
  assignedAgentId: z.string().optional().nullable(),
});

// ===== עדכונים =====

export const updateVersionSchema = z.object({
  version: z.string().min(1, "יש להזין גרסה"),
  price: z.number().min(0, "מחיר לא תקין"),
  updateType: z.enum(["FULL", "PARTIAL"]).optional().default("FULL"),
  status: z.enum(["DRAFT", "PREPARING", "READY", "SENDING", "COMPLETED"]).optional(),
  releaseDate: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  rhythmsFileUrl: z.string().optional().nullable(),
  samplesFileUrl: z.string().optional().nullable(),
  personalizedSamplesZipUrl: z.string().optional().nullable(),
  ppfFileUrl: z.string().optional().nullable(),
  masterZipUrl: z.string().optional().nullable(),
  emailSubject: z.string().optional().nullable(),
  emailBody: z.string().optional().nullable(),
  emailTemplateMap: z.record(z.unknown()).optional().nullable(),
});

// ===== תבניות מייל =====

export const emailTemplateSchema = z.object({
  name: z.string().min(1, "יש להזין שם תבנית"),
  subject: z.string().min(1, "יש להזין נושא"),
  body: z.string().min(1, "יש להזין תוכן"),
  category: z.string().optional().nullable(),
  variables: z.array(z.string()).optional(),
});

// ===== מבצעים =====

export const promotionSchema = z.object({
  name: z.string().min(1, "יש להזין שם מבצע"),
  discountPercent: z.number().min(0).max(100).default(0),
  discountAmount: z.number().min(0).default(0),
  couponCode: z.string().min(3, "קוד קופון חייב להכיל לפחות 3 תווים"),
  validFrom: z.string(),
  validUntil: z.string(),
  maxUses: z.number().optional().nullable(),
});

// ===== נתונים =====

export const organSchema = z.object({
  name: z.string().min(1, "יש להזין שם אורגן"),
  folderAlias: z.string().optional().nullable(),
  demoAlias: z.string().optional().nullable(),
  installFileName: z.string().optional().nullable(),
  organInfoFileUrl: z.string().optional().nullable(),
  supportsUpdates: z.boolean(),
  sortOrder: z.number().optional(),
});

export const setTypeSchema = z.object({
  name: z.string().min(1, "יש להזין שם סוג סט"),
  folderAlias: z.string().optional().nullable(),
  demoAlias: z.string().optional().nullable(),
  price: z.number().min(0, "מחיר לא תקין"),
  includesUpdates: z.boolean(),
  sortOrder: z.number().optional(),
});

// ===== הזמנה ציבורית =====

export const publicOrderSchema = z.object({
  fullName: z.string().min(2, "שם חייב להכיל לפחות 2 תווים"),
  phone: z.string().min(9, "מספר טלפון לא תקין"),
  email: z.string().email("כתובת מייל לא תקינה"),
  organId: z.string().min(1, "יש לבחור אורגן"),
  isUpdateOnly: z.boolean().default(false),
  setTypeId: z.string().optional().nullable(),
  updateVersionId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.isUpdateOnly) return !!data.updateVersionId;
    return !!data.setTypeId;
  },
  (data) => ({
    message: data.isUpdateOnly
      ? "יש לבחור גרסת עדכון"
      : "יש לבחור סוג סט",
    path: data.isUpdateOnly ? ["updateVersionId"] : ["setTypeId"],
  })
);

// ===== Auth =====

export const loginSchema = z.object({
  email: z.string().min(1, "נא להזין כתובת אימייל").email("כתובת אימייל לא תקינה"),
  password: z.string().min(1, "נא להזין סיסמה").min(6, "הסיסמה חייבת להכיל לפחות 6 תווים"),
});
