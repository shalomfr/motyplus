// ===== BillingClient Interface =====

import type {
  BillingCustomer,
  CreateDocumentRequest,
  CreateDocumentResponse,
  DocumentInfo,
  RawDocument,
  DocumentFilters,
  CreatePaymentPageRequest,
  PaymentPageResponse,
} from "./types";

export interface BillingClient {
  testConnection(): Promise<{ success: boolean; error?: string }>;
  createCustomer(customer: BillingCustomer): Promise<string>;
  updateCustomer(clientId: string, customer: Partial<BillingCustomer>): Promise<void>;
  createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse>;
  getDocument(docId: string): Promise<DocumentInfo>;
  getDocuments(filters?: DocumentFilters): Promise<RawDocument[]>;
  createPaymentPage(request: CreatePaymentPageRequest): Promise<PaymentPageResponse>;
}
