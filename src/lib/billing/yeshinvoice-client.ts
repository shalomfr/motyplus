// ===== YeshInvoice Client =====

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

interface YeshInvoiceResponse<T = unknown> {
  Success: boolean;
  ErrorMessage: string;
  ReturnValue: T;
}

interface YeshDocumentResult {
  id: number;
  docNumber: number;
  url: string;
  pdfurl: string;
  copypdfurl?: string;
  paymenturl?: string;
}

interface YeshInvoiceListItem {
  ID?: number;
  Date?: string;
  DocumentNumber?: number;
  DocumentType?: number;
  StatusID?: number;
  Title?: string;
  TotalPrice?: number;
  CustomerName?: string;
  CustomerNumberID?: string;
  pdfUrl?: string;
  items?: unknown[];
  [key: string]: unknown;
}

const BASE_URL = "https://api.yeshinvoice.co.il";

export class YeshInvoiceClient implements BillingClient {
  private authHeader: string;

  constructor(authJson: string) {
    // authJson is the raw JSON string: {"secret":"...","userkey":"..."}
    this.authHeader = authJson;
  }

  // ===== Mapping helpers =====

  private static mapDocType(dt: DocumentType): number {
    const map: Record<DocumentType, number> = {
      quote: 1,
      receipt: 6,
      tax_invoice: 8,
      invoice_receipt: 9,
      credit_note: 10,
    };
    return map[dt] ?? 9;
  }

  private static mapDocTypeReverse(code: number): string {
    const map: Record<number, string> = {
      1: "הצעת מחיר",
      2: "הזמנה",
      3: "תעודת משלוח",
      5: "חשבון עסקה",
      6: "קבלה",
      8: "חשבונית מס",
      9: "חשבונית מס-קבלה",
      10: "חשבונית זיכוי",
      11: "קבלה לתרומה",
    };
    return map[code] || String(code);
  }

  private static mapCurrency(currency?: string): number {
    const map: Record<string, number> = { ILS: 2, EUR: 9, USD: 29 };
    return map[currency?.toUpperCase() || "ILS"] || 2;
  }

  private static mapLang(lang?: string): number {
    return lang === "en" ? 139 : 359;
  }

  private static mapPaymentType(pt: PaymentType): number {
    const map: Record<PaymentType, number> = {
      cash: 1,
      check: 2,
      bank_transfer: 3,
      credit_card: 5,
    };
    return map[pt] ?? 5;
  }

  // ===== HTTP helper =====

  private async request<T>(endpoint: string, body?: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.authHeader,
        },
        body: JSON.stringify(body || {}),
        signal: controller.signal,
      });

      const data = (await res.json()) as YeshInvoiceResponse<T>;

      if (!data.Success) {
        throw new Error(data.ErrorMessage || "YeshInvoice request failed");
      }

      return data.ReturnValue;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("YeshInvoice request timeout (30s)");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ===== BillingClient implementation =====

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request<unknown[]>("/api/v1/getlanguages");
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async createCustomer(customer: BillingCustomer): Promise<string> {
    const result = await this.request<{ id?: number; securekey?: string }>(
      "/api/v1/addCustomer",
      {
        name: customer.name,
        nameOnInvoice: customer.name,
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        city: customer.city || "",
        numberid: customer.vatId || "",
        customkey: customer.id || "",
      }
    );
    return String(result.id || result.securekey || "");
  }

  async updateCustomer(clientId: string, customer: Partial<BillingCustomer>): Promise<void> {
    const body: Record<string, unknown> = { id: Number(clientId) };
    if (customer.name) {
      body.name = customer.name;
      body.nameOnInvoice = customer.name;
    }
    if (customer.email) body.email = customer.email;
    if (customer.phone) body.phone = customer.phone;
    if (customer.address) body.address = customer.address;
    if (customer.city) body.city = customer.city;
    if (customer.vatId) body.numberid = customer.vatId;
    await this.request("/api/v1/addCustomer", body);
  }

  async createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const maxDate = new Date(now);
    maxDate.setMonth(maxDate.getMonth() + 1);
    const maxDateStr = maxDate.toISOString().slice(0, 10);

    const totalAmount = request.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const body: Record<string, unknown> = {
      DocumentType: YeshInvoiceClient.mapDocType(request.docType),
      CurrencyID: YeshInvoiceClient.mapCurrency(request.currency),
      LangID: YeshInvoiceClient.mapLang(request.lang),
      DateCreated: dateStr,
      MaxDate: maxDateStr,
      statusID: 1,
      SendEmail: request.sendEmail ?? false,
      SendSMS: false,
      Customer: {
        Name: request.customer.name,
        NameInvoice: request.customer.name,
        EmailAddress: request.customer.email || "",
        Phone: request.customer.phone || "",
        Address: request.customer.address || "",
        City: request.customer.city || "",
        NumberID: request.customer.vatId || "",
        ID: request.customer.id ? Number(request.customer.id) : -1,
      },
      items: request.items.map((item) => ({
        Name: item.description,
        Quantity: item.quantity,
        Price: item.unitPrice,
        vatType: 4,
        SkuID: -1,
      })),
    };

    // Add payment info for receipt-type documents
    if (
      request.docType === "receipt" ||
      request.docType === "invoice_receipt"
    ) {
      body.payments = [
        {
          Price: totalAmount,
          TypeID: request.paymentType
            ? YeshInvoiceClient.mapPaymentType(request.paymentType)
            : 5,
          NumberofPayments: 1,
        },
      ];
    }

    const result = await this.request<YeshDocumentResult>(
      "/api/v1.1/createDocument",
      body
    );

    return {
      id: String(result.id),
      number: String(result.docNumber),
      url: result.url || "",
      pdfUrl: result.pdfurl || undefined,
      amount: totalAmount,
    };
  }

  async getDocument(docId: string): Promise<DocumentInfo> {
    // YeshInvoice doesn't have a single-doc endpoint like iCount.
    // We search for it via getInvoices.
    const docs = await this.request<YeshInvoiceListItem[]>("/api/v1/getInvoices", {
      CustomerID: -1,
      PageSize: 1,
      PageNumber: 1,
      Search: docId,
      docTypes: [],
    });

    const doc = docs[0];
    if (!doc) {
      return { docUrl: "", pdfUrl: "", docNumber: docId };
    }

    return {
      docUrl: String(doc.pdfUrl || ""),
      pdfUrl: String(doc.pdfUrl || ""),
      docNumber: String(doc.DocumentNumber || docId),
    };
  }

  async getDocuments(filters?: DocumentFilters): Promise<RawDocument[]> {
    const docTypes: number[] = [];
    if (filters?.docType) {
      // Try to map string doctype to YeshInvoice number
      const typeMap: Record<string, number> = {
        receipt: 6,
        invoice: 8,
        tax_invoice: 8,
        invoice_receipt: 9,
        invrec: 9,
        credit_note: 10,
        quote: 1,
        offer: 1,
      };
      const mapped = typeMap[filters.docType];
      if (mapped) docTypes.push(mapped);
    }

    const body: Record<string, unknown> = {
      CustomerID: -1,
      PageSize: 100,
      PageNumber: 1,
      Search: "",
      docTypes,
    };

    // Use getOpenInvoices if date filters are provided (supports from/to)
    if (filters?.fromDate || filters?.toDate) {
      const endpoint = "/api/v1/getOpenInvoices";
      if (filters.fromDate) body.from = `${filters.fromDate} 00:00`;
      if (filters.toDate) body.to = `${filters.toDate} 23:59`;
      body.PageSize = 100;
      body.PageNumber = 1;

      const result = await this.request<YeshInvoiceListItem[]>(endpoint, body);
      return this.normalizeDocList(result);
    }

    const result = await this.request<YeshInvoiceListItem[]>(
      "/api/v1/getInvoices",
      body
    );
    return this.normalizeDocList(result);
  }

  private normalizeDocList(docs: YeshInvoiceListItem[]): RawDocument[] {
    return docs.map((doc) => ({
      doc_id: String(doc.ID || doc.DocumentNumber || ""),
      docnum: String(doc.DocumentNumber || ""),
      doctype: YeshInvoiceClient.mapDocTypeReverse(doc.DocumentType || 0),
      doc_url: doc.pdfUrl || "",
      client_name: doc.CustomerName || "",
      client_id: 0,
      total: doc.TotalPrice || 0,
      totalwithvat: doc.TotalPrice || 0,
      dateissued: doc.Date || "",
    }));
  }

  async createPaymentPage(
    request: CreatePaymentPageRequest
  ): Promise<PaymentPageResponse> {
    const totalAmount = request.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const invoiceTitle =
      request.items.map((i) => i.description).join(", ") || "Motty Beats";

    const body: Record<string, unknown> = {
      Title: request.pageName || "Motty Beats",
      Body: "",
      SuccessUrl: request.successUrl,
      ErrorUrl: request.cancelUrl,
      NotifyUrl: request.webhookUrl || "",
      TotalPrice: totalAmount,
      NumPayments: 1,
      PaymentType: 1,
      InvoiceName: request.customer.name,
      InvoiceTitle: invoiceTitle,
      InvoiceEmailAddress: request.customer.email || "",
      InvoicePhone: request.customer.phone || "",
      CurrencyID: YeshInvoiceClient.mapCurrency(request.currency),
      InvoiceLangID: YeshInvoiceClient.mapLang(request.lang),
      SendInvoiceEmail: true,
      NoCreateInvoice: !(request.autoCreateDoc ?? true),
      DocumentType: request.docType
        ? YeshInvoiceClient.mapDocType(request.docType)
        : 9,
    };

    // Pass metadata via Fields1
    if (request.metadata) {
      body.Fields1 = JSON.stringify(request.metadata);
    }

    const url = await this.request<string>("/api/v1/createPayment", body);
    return { url, pageId: "" };
  }
}
