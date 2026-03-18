// ===== iCount Adapter — wraps existing ICountClient =====

import { ICountClient } from "@/lib/icount/client";
import type { ICountCustomer, ICountDocumentType, ICountPaymentType } from "@/lib/icount/types";
import type { BillingClient } from "./client";
import type {
  BillingCustomer,
  CreateDocumentRequest,
  CreateDocumentResponse,
  DocumentInfo,
  RawDocument,
  DocumentFilters,
  CreatePaymentPageRequest,
  PaymentPageResponse,
  DocumentType,
  PaymentType,
} from "./types";

export class ICountAdapter implements BillingClient {
  constructor(private client: ICountClient) {}

  // ===== Mapping helpers =====

  private mapCustomer(c: BillingCustomer): ICountCustomer {
    return {
      client_name: c.name,
      client_id: c.id,
      email: c.email,
      phone: c.phone,
      address: c.address,
      city: c.city,
      vat_id: c.vatId,
    };
  }

  private mapDocType(dt: DocumentType): ICountDocumentType {
    return dt as ICountDocumentType;
  }

  private mapPaymentType(pt: PaymentType): ICountPaymentType {
    return pt as ICountPaymentType;
  }

  // ===== BillingClient implementation =====

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return this.client.testConnection();
  }

  async createCustomer(customer: BillingCustomer): Promise<string> {
    return this.client.createCustomer(this.mapCustomer(customer));
  }

  async updateCustomer(clientId: string, customer: Partial<BillingCustomer>): Promise<void> {
    const mapped: Partial<ICountCustomer> = {};
    if (customer.name) mapped.client_name = customer.name;
    if (customer.email) mapped.email = customer.email;
    if (customer.phone) mapped.phone = customer.phone;
    if (customer.address) mapped.address = customer.address;
    if (customer.city) mapped.city = customer.city;
    if (customer.vatId) mapped.vat_id = customer.vatId;
    await this.client.updateCustomer(clientId, mapped);
  }

  async createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    const icountRequest = {
      customer: this.mapCustomer(request.customer),
      items: request.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitprice: item.unitPrice,
      })),
      docType: this.mapDocType(request.docType),
      paymentType: request.paymentType ? this.mapPaymentType(request.paymentType) : undefined,
      currency: request.currency,
      lang: request.lang,
      sendEmail: request.sendEmail,
    };

    switch (request.docType) {
      case "receipt":
        return this.client.createReceipt(icountRequest);
      case "tax_invoice":
        return this.client.createInvoice(icountRequest);
      case "invoice_receipt":
        return this.client.createInvoiceReceipt(icountRequest);
      case "credit_note":
        return this.client.createCreditNote(icountRequest);
      case "quote":
        return this.client.createQuote(icountRequest);
      default:
        return this.client.createInvoice(icountRequest);
    }
  }

  async getDocument(docId: string): Promise<DocumentInfo> {
    const doc = await this.client.getDocument(docId);
    return {
      docUrl: doc.doc_url,
      pdfUrl: doc.pdf_url,
      docNumber: doc.docnum,
    };
  }

  async getDocuments(filters?: DocumentFilters): Promise<RawDocument[]> {
    return this.client.getDocuments({
      doctype: filters?.docType,
      from_date: filters?.fromDate,
      to_date: filters?.toDate,
    });
  }

  async createPaymentPage(request: CreatePaymentPageRequest): Promise<PaymentPageResponse> {
    const result = await this.client.createPaymentPage({
      customer: this.mapCustomer(request.customer),
      items: request.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitprice: item.unitPrice,
      })),
      pageName: request.pageName,
      successUrl: request.successUrl,
      cancelUrl: request.cancelUrl,
      webhookUrl: request.webhookUrl,
      docType: request.docType ? this.mapDocType(request.docType) : undefined,
      autoCreateDoc: request.autoCreateDoc,
      currency: request.currency,
      lang: request.lang,
      metadata: request.metadata,
    });
    return { url: result.url, pageId: result.pageId };
  }
}
