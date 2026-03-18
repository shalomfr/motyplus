// ===== iCount API Types =====

export interface ICountResponse<T = unknown> {
  status: boolean;
  reason?: string;
  error_description?: string;
  data?: T;
}

export interface ICountCustomer {
  client_name: string;
  client_id?: string; // מזהה לקוח קיים ב-iCount (מונע כפילויות)
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  vat_id?: string; // מספר עוסק מורשה
}

export interface ICountDocumentItem {
  description: string;
  quantity: number;
  unitprice: number;
  // vat_type?: string;
}

export type ICountDocumentType =
  | "receipt"        // 400 — קבלה
  | "tax_invoice"    // 305 — חשבונית מס
  | "invoice_receipt" // 320 — חשבונית מס-קבלה
  | "credit_note"    // 330 — חשבונית זיכוי
  | "quote";         // 10 — הצעת מחיר

export type ICountPaymentType =
  | "cash"           // 1
  | "check"          // 2
  | "bank_transfer"  // 3
  | "credit_card";   // 4

export interface CreateDocumentRequest {
  customer: ICountCustomer;
  items: ICountDocumentItem[];
  docType: ICountDocumentType;
  paymentType?: ICountPaymentType;
  currency?: string;
  lang?: string;
  sendEmail?: boolean;
}

export interface CreateDocumentResponse {
  id: string;
  number: string;
  url: string;
  pdfUrl?: string;
  amount: number;
}

export interface ICountRawDocResponse {
  doc_id?: string;
  docnum?: string;
  doc_url?: string;
  pdf_url?: string;
  total?: number;
  // שדות משתנים בגרסאות שונות של ה-API
  [key: string]: unknown;
}

export interface CreatePaymentPageRequest {
  customer: ICountCustomer;
  items: ICountDocumentItem[];
  pageName?: string;
  successUrl: string;
  cancelUrl: string;
  webhookUrl?: string;
  docType?: ICountDocumentType;
  autoCreateDoc?: boolean;
  currency?: string;
  lang?: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentPageResponse {
  url: string;
  pageId: string;
}

export interface ICountSettings {
  companyId?: string;
  vatExempt?: boolean;
  defaultLanguage?: string;
  autoSendEmail?: boolean;
}

export interface ICountWebhookPayload {
  // Document webhook (סעיף 22 בתיעוד)
  doctype?: string;
  docnum?: string;
  timeissued?: string;
  dateissued?: string;
  clientname?: string;
  clientaddress?: string;
  totalsum?: string;
  totalvat?: string;
  totalwithvat?: string;
  items?: Array<{
    item_id?: string;
    description?: string;
    unitprice?: string;
    quantity?: string;
  }>;
  doc_link?: string;
  pdf_link?: string;
  client?: {
    email?: string;
    phone?: string;
    client_vat_id?: string;
  };

  // Payment page webhook / IPN (סעיף 22א בתיעוד)
  cp?: number; // payment page number
  sum?: number;
  currency_code?: string;
  num_of_payments?: number;
  confirmation_code?: string;
  customer_id?: number;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_vat_id?: string;
  // Custom fields (m__ prefix parameters are returned without prefix)
  [key: string]: unknown;
}

export interface ICountIpnPayload extends ICountWebhookPayload {
  // IPN-specific fields
  doctype?: string;
  docnum?: string;
  doc_url?: string;
  status?: string;
  custom_fields?: Record<string, string> | string;
  payment_id?: string;
  client_id?: string | number;
  total?: number | string;
}
