// ===== Green Invoice (morning) Client — מימוש BillingClient =====

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

interface GreenInvoiceConfig {
  id: string;      // API Key ID
  secret: string;  // API Key Secret
}

const BASE_URL = "https://api.greeninvoice.co.il/api/v1";

export class GreenInvoiceClient implements BillingClient {
  private config: GreenInvoiceConfig;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(authJson: string) {
    this.config = JSON.parse(authJson) as GreenInvoiceConfig;
  }

  // ===== Mapping helpers =====

  private static mapDocType(dt: DocumentType): number {
    // Green Invoice document types — 320 (receipt) used as default
    // because types 300/305 are rejected for this business config
    const map: Record<DocumentType, number> = {
      tax_invoice: 320,
      invoice_receipt: 320,
      receipt: 320,
      credit_note: 330,
      quote: 20,
    };
    return map[dt] ?? 320;
  }

  private static mapDocTypeReverse(code: number): string {
    const map: Record<number, string> = {
      10: "הזמנה",
      20: "הצעת מחיר",
      100: "חשבונית עסקה",
      300: "חשבונית מס",
      305: "חשבונית מס-קבלה",
      320: "קבלה",
      330: "חשבונית זיכוי",
      400: "קבלה על תרומה",
    };
    return map[code] || String(code);
  }

  private static mapCurrency(currency?: string): string {
    return currency?.toUpperCase() || "ILS";
  }

  private static mapPaymentType(pt: PaymentType): number {
    // Green Invoice payment types
    const map: Record<PaymentType, number> = {
      cash: 1,
      check: 2,
      bank_transfer: 3,
      credit_card: 4,
    };
    return map[pt] ?? 4;
  }

  // ===== Auth =====

  private async getToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.token && Date.now() < this.tokenExpiry - 60000) {
      return this.token;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${BASE_URL}/account/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: this.config.id,
          secret: this.config.secret,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(
          (error as { errorMessage?: string }).errorMessage ||
            `Green Invoice auth failed: ${res.status}`
        );
      }

      const data = (await res.json()) as { token: string; expires?: string };
      this.token = data.token;
      // Token typically valid for ~30 minutes
      this.tokenExpiry = data.expires
        ? new Date(data.expires).getTime()
        : Date.now() + 25 * 60 * 1000;

      return this.token;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Green Invoice auth timeout (30s)");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ===== HTTP helper =====

  private async request<T>(
    endpoint: string,
    body?: Record<string, unknown>,
    method: string = "POST"
  ): Promise<T> {
    const token = await this.getToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      };

      if (body && method !== "GET") {
        options.body = JSON.stringify(body);
      }

      const res = await fetch(`${BASE_URL}/${endpoint}`, options);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        let errorMessage = `Green Invoice error: ${res.status}`;
        try {
          const parsed = JSON.parse(errorBody);
          errorMessage = parsed.errorMessage || `Green Invoice error: ${res.status} — ${errorBody}`;
        } catch {
          errorMessage = `Green Invoice error: ${res.status} — ${errorBody}`;
        }
        throw new Error(errorMessage);
      }

      return (await res.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Green Invoice request timeout (30s)");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ===== BillingClient implementation =====

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.getToken();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async createCustomer(customer: BillingCustomer): Promise<string> {
    const result = await this.request<{ id: string }>("clients", {
      name: customer.name,
      emails: customer.email ? [customer.email] : [],
      phone: customer.phone || "",
      address: customer.address || "",
      city: customer.city || "",
      taxId: customer.vatId || "",
    });
    return result.id;
  }

  async updateCustomer(
    clientId: string,
    customer: Partial<BillingCustomer>
  ): Promise<void> {
    const body: Record<string, unknown> = {};
    if (customer.name) body.name = customer.name;
    if (customer.email) body.emails = [customer.email];
    if (customer.phone) body.phone = customer.phone;
    if (customer.address) body.address = customer.address;
    if (customer.city) body.city = customer.city;
    if (customer.vatId) body.taxId = customer.vatId;

    await this.request(`clients/${clientId}`, body, "PUT");
  }

  async createDocument(
    request: CreateDocumentRequest
  ): Promise<CreateDocumentResponse> {
    const totalAmount = request.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const body: Record<string, unknown> = {
      type: GreenInvoiceClient.mapDocType(request.docType),
      lang: request.lang === "en" ? "en" : "he",
      currency: GreenInvoiceClient.mapCurrency(request.currency),
      amount: totalAmount,
      client: {
        name: request.customer.name,
        emails: request.customer.email ? [request.customer.email] : [],
        phone: request.customer.phone || "",
        address: request.customer.address || "",
        city: request.customer.city || "",
        taxId: request.customer.vatId || "",
        add: true,
      },
      income: request.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        price: item.unitPrice,
        currency: GreenInvoiceClient.mapCurrency(request.currency),
        vatType: 1,
      })),
    };

    // Add payment info for receipt-type documents (not for quotes)
    if (request.docType !== "quote") {
      body.payment = [
        {
          type: request.paymentType
            ? GreenInvoiceClient.mapPaymentType(request.paymentType)
            : 4,
          price: totalAmount,
          date: new Date().toISOString().slice(0, 10),
        },
      ];
    }

    // Note: emailContent causes 400 error on Morning for type 320
    // Morning sends email automatically when client has email

    const result = await this.request<{
      id: string;
      number: number;
      url: { origin: string; he: string; en: string };
      amount: number;
    }>("documents", body);

    return {
      id: result.id,
      number: String(result.number),
      url: result.url?.he || result.url?.origin || "",
      pdfUrl: result.url?.origin || undefined,
      amount: result.amount || totalAmount,
    };
  }

  async getDocument(docId: string): Promise<DocumentInfo> {
    const result = await this.request<{
      id: string;
      number: number;
      url: { origin: string; he: string; en: string };
    }>(`documents/${docId}`, undefined, "GET");

    // Get download links
    let pdfUrl = result.url?.origin || "";
    try {
      const links = await this.request<{
        original: string;
        copy: string;
      }>(`documents/${docId}/download`, undefined, "GET");
      pdfUrl = links.original || links.copy || pdfUrl;
    } catch {
      // Fallback to URL from document
    }

    return {
      docUrl: result.url?.he || result.url?.origin || "",
      pdfUrl,
      docNumber: String(result.number),
    };
  }

  async getDocuments(filters?: DocumentFilters): Promise<RawDocument[]> {
    const body: Record<string, unknown> = {
      page: 1,
      pageSize: 100,
    };

    if (filters?.fromDate) body.fromDate = filters.fromDate;
    if (filters?.toDate) body.toDate = filters.toDate;

    if (filters?.docType) {
      const typeMap: Record<string, number> = {
        receipt: 320,
        invoice: 300,
        tax_invoice: 300,
        invoice_receipt: 305,
        invrec: 305,
        credit_note: 330,
        quote: 20,
      };
      const mapped = typeMap[filters.docType];
      if (mapped) body.type = [mapped];
    }

    const result = await this.request<{
      items: Array<{
        id: string;
        number: number;
        type: number;
        amount: number;
        client?: { name?: string; id?: string };
        documentDate?: string;
        createdAt?: string;
        url?: { origin?: string; he?: string };
        status?: number;
        [key: string]: unknown;
      }>;
    }>("documents/search", body);

    return (result.items || []).map((doc) => ({
      doc_id: doc.id,
      docnum: String(doc.number || ""),
      doctype: GreenInvoiceClient.mapDocTypeReverse(doc.type || 0),
      doc_url: doc.url?.he || doc.url?.origin || "",
      client_name: doc.client?.name || "",
      client_id: doc.client?.id || "",
      total: doc.amount || 0,
      totalwithvat: doc.amount || 0,
      dateissued: doc.documentDate || doc.createdAt || "",
    }));
  }

  // Get active payment terminal plugin ID
  private async getPluginId(): Promise<string | null> {
    try {
      const plugins = await this.request<
        Array<{ id: string; type: number; active: boolean; payments: boolean }>
      >("plugins", undefined, "GET");
      const terminal = plugins.find(
        (p) => p.type === 12200 && p.active && p.payments
      );
      return terminal?.id || null;
    } catch {
      return null;
    }
  }

  async createPaymentPage(
    request: CreatePaymentPageRequest
  ): Promise<PaymentPageResponse> {
    const totalAmount = request.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const pluginId = await this.getPluginId();

    const body: Record<string, unknown> = {
      type: request.docType
        ? GreenInvoiceClient.mapDocType(request.docType)
        : 320,
      lang: request.lang === "en" ? "en" : "he",
      currency: GreenInvoiceClient.mapCurrency(request.currency),
      amount: totalAmount,
      description: request.items.map((i) => i.description).join(", "),
      client: {
        name: request.customer.name,
        emails: request.customer.email ? [request.customer.email] : [],
        phone: request.customer.phone || "",
        add: true,
      },
      income: request.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        price: item.unitPrice,
        currency: GreenInvoiceClient.mapCurrency(request.currency),
        vatType: 1,
      })),
      successUrl: request.successUrl,
      failureUrl: request.cancelUrl,
      maxPayments: 6,
      allowBit: true,
      allowApplePay: true,
      allowGooglePay: true,
      allowPaypal: true,
      allowBankTransfer: true,
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    };

    if (pluginId) {
      body.pluginId = pluginId;
    }

    // Webhook URL — only include if provided (empty string causes validation error)
    if (request.webhookUrl) {
      body.notifyUrl = request.webhookUrl;
    }

    // Pass metadata via custom field
    if (request.metadata) {
      body.custom = JSON.stringify(request.metadata);
    }

    const result = await this.request<{
      success?: boolean;
      errorCode?: number;
      errorMessage?: string;
      id?: string;
      url?: string;
    }>("payments/form", body);

    if (result.errorCode && result.errorCode !== 0) {
      throw new Error(result.errorMessage || `Payment form error: ${result.errorCode}`);
    }

    return {
      url: result.url || "",
      pageId: result.id || "",
    };
  }
}
