// ===== Unified Billing Provider Types =====

export interface BillingCustomer {
  name: string;
  id?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  vatId?: string;
}

export type DocumentType =
  | "receipt"
  | "tax_invoice"
  | "invoice_receipt"
  | "credit_note"
  | "quote";

export type PaymentType =
  | "cash"
  | "check"
  | "bank_transfer"
  | "credit_card";

export interface DocumentItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateDocumentRequest {
  customer: BillingCustomer;
  items: DocumentItem[];
  docType: DocumentType;
  paymentType?: PaymentType;
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

export interface DocumentInfo {
  docUrl: string;
  pdfUrl: string;
  docNumber: string;
}

export interface RawDocument {
  [key: string]: unknown;
}

export interface DocumentFilters {
  docType?: string;
  fromDate?: string;
  toDate?: string;
}

export interface CreatePaymentPageRequest {
  customer: BillingCustomer;
  items: DocumentItem[];
  pageName?: string;
  successUrl: string;
  cancelUrl: string;
  webhookUrl?: string;
  docType?: DocumentType;
  autoCreateDoc?: boolean;
  currency?: string;
  lang?: string;
  metadata?: Record<string, string>;
  group?: number; // Grow payment method: 100=credit, 120=bit, 150=google, 160=apple
}

export interface PaymentPageResponse {
  url: string;
  pageId: string;
}
