import { z } from "zod";

// ===== לקוחות =====

export const customerSchema = z.object({
  fullName: z.string().min(2, "שם חייב להכיל לפחות 2 תווים"),
  phone: z.string().min(9, "מספר טלפון לא תקין"),
  whatsappPhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  email: z.string().email("כתובת מייל לא תקינה"),
  organId: z.string().min(1, "יש לבחור אורגן"),
  additionalOrganId: z.string().optional().nullable(),
  setTypeId: z.string().min(1, "יש לבחור סוג סט"),
  customerId: z.string().optional().nullable(),
  amountPaid: z.number().min(0, "סכום לא תקין"),
  purchaseDate: z.string().optional(),
  notes: z.string().optional().nullable(),
  infoFileUrl: z.string().optional().nullable(),
});

export const customerUpdateSchema = customerSchema.partial().extend({
  status: z.enum(["ACTIVE", "BLOCKED", "FROZEN", "EXCEPTION"]).optional(),
  sampleType: z.enum(["CPI", "CPF"]).optional(),
  currentUpdateVersion: z.string().optional().nullable(),
  hasV3: z.boolean().optional(),
});

// ===== לידים =====

export const leadSchema = z.object({
  fullName: z.string().min(2, "שם חייב להכיל לפחות 2 תווים"),
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
  releaseDate: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  rhythmsFileUrl: z.string().optional().nullable(),
  samplesFileUrl: z.string().optional().nullable(),
  personalizedSamplesZipUrl: z.string().optional().nullable(),
  masterZipUrl: z.string().optional().nullable(),
  emailSubject: z.string().optional().nullable(),
  emailBody: z.string().optional().nullable(),
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
  discountPercent: z.number().min(1).max(100, "אחוז הנחה חייב להיות בין 1 ל-100"),
  couponCode: z.string().min(3, "קוד קופון חייב להכיל לפחות 3 תווים"),
  validFrom: z.string(),
  validUntil: z.string(),
  maxUses: z.number().optional().nullable(),
});

// ===== נתונים =====

export const organSchema = z.object({
  name: z.string().min(1, "יש להזין שם אורגן"),
  folderAlias: z.string().optional().nullable(),
  organInfoFileUrl: z.string().optional().nullable(),
  supportsUpdates: z.boolean(),
  sortOrder: z.number().optional(),
});

export const setTypeSchema = z.object({
  name: z.string().min(1, "יש להזין שם סוג סט"),
  folderAlias: z.string().optional().nullable(),
  price: z.number().min(0, "מחיר לא תקין"),
  includesUpdates: z.boolean(),
  sortOrder: z.number().optional(),
});

// ===== Auth =====

export const loginSchema = z.object({
  email: z.string().email("כתובת מייל לא תקינה"),
  password: z.string().min(6, "סיסמה חייבת להכיל לפחות 6 תווים"),
});
