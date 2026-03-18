// ===== iCount API Types =====

export interface ICountResponse<T = unknown> {
  status: boolean;
  reason?: string;
  error_description?: string;
  data?: T;
}

export interface ICountCustomer {
  client_name: string;
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
