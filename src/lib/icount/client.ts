import type {
  ICountResponse,
  ICountCustomer,
  ICountDocumentItem,
  ICountDocumentType,
  ICountPaymentType,
  CreateDocumentRequest,
  CreateDocumentResponse,
  ICountRawDocResponse,
  CreatePaymentPageRequest,
  CreatePaymentPageResponse,
  ICountSettings,
} from "./types";

const BASE_URL = "https://api.icount.co.il/api/v3.php";

export class ICountClient {
  private companyId: string;
  private username: string;
  private password: string;
  private apiToken: string | null = null;
  private sid: string | null = null;
  private settings: ICountSettings;

  constructor(companyId: string, credentials: string, settings?: ICountSettings) {
    this.companyId = companyId;
    // credentials format: "email|||password" OR just API token (starts with "API")
    if (credentials.startsWith("API")) {
      this.apiToken = credentials;
      this.username = "";
      this.password = "";
    } else {
      const parts = credentials.split("|||");
      this.username = parts[0] || "";
      this.password = parts[1] || "";
    }
    this.settings = settings || {};
  }

  // ===== Auth =====

  private async login(): Promise<string> {
    // API token mode — no login needed
    if (this.apiToken) {
      this.sid = this.apiToken;
      return this.sid;
    }

    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cid: this.companyId,
        user: this.username,
        pass: this.password,
      }),
    });

    const data = (await res.json()) as ICountResponse<{ sid?: string }>;
    if (!data.status || !data.data?.sid) {
      throw new Error(data.reason || data.error_description || "iCount login failed");
    }

    this.sid = data.data.sid;
    return this.sid;
  }

  private getAuthParams(): Record<string, string> {
    if (this.apiToken) {
      // Bearer mode — auth is in header only, no body params needed
      return {};
    }
    return { sid: this.sid || "" };
  }

  private async request<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    if (!this.sid && !this.apiToken) {
      await this.login();
    }

    const authParams = this.getAuthParams();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiToken) {
      headers["Authorization"] = `Bearer ${this.apiToken}`;
    }
    const res = await fetch(`${BASE_URL}/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, ...authParams }),
    });

    const data = (await res.json()) as ICountResponse<T>;

    // Session expired — retry once (only for SID mode)
    if (!this.apiToken && !data.status && (data.reason?.includes("session") || data.reason?.includes("sid"))) {
      this.sid = null;
      await this.login();
      const retryRes = await fetch(`${BASE_URL}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, ...this.getAuthParams() }),
      });
      const retryData = (await retryRes.json()) as ICountResponse<T>;
      if (!retryData.status) {
        throw new Error(retryData.reason || retryData.error_description || "iCount request failed");
      }
      return retryData.data as T;
    }

    if (!data.status) {
      throw new Error(data.reason || data.error_description || "iCount request failed");
    }

    // iCount returns fields at root level, not nested in data
    return (data.data || data) as T;
  }

  // ===== Connection Test =====

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.apiToken) {
        // Test API token by fetching doc types
        await this.request("doc/get_doc_types", {});
        return { success: true };
      }
      await this.login();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ===== Customers =====

  async createCustomer(customer: ICountCustomer): Promise<string> {
    const data = await this.request<{ client_id?: string }>("client/create", {
      client_name: customer.client_name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      vat_id: customer.vat_id,
    });
    return data.client_id || "";
  }

  async updateCustomer(clientId: string, customer: Partial<ICountCustomer>): Promise<void> {
    await this.request("client/update", {
      client_id: clientId,
      ...customer,
    });
  }

  // ===== Documents =====

  private mapDocType(docType: ICountDocumentType): string {
    const map: Record<ICountDocumentType, string> = {
      receipt: "receipt",
      tax_invoice: "invoice",
      invoice_receipt: "invrec",
      credit_note: "creditnote",
      quote: "quote",
    };
    return map[docType] || "receipt";
  }

  private mapPaymentType(paymentType: ICountPaymentType): number {
    const map: Record<ICountPaymentType, number> = {
      cash: 1,
      check: 2,
      bank_transfer: 3,
      credit_card: 4,
    };
    return map[paymentType] || 4;
  }

  private buildDocumentData(request: CreateDocumentRequest): Record<string, unknown> {
    return {
      doctype: this.mapDocType(request.docType),
      client_name: request.customer.client_name,
      email: request.customer.email,
      phone: request.customer.phone,
      items: request.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitprice: item.unitprice,
      })),
      currency_code: request.currency || "ILS",
      lang: request.lang || this.settings.defaultLanguage || "he",
      send_email: request.sendEmail ?? this.settings.autoSendEmail ?? false,
      ...(request.paymentType ? { pay_type: this.mapPaymentType(request.paymentType) } : {}),
    };
  }

  private normalizeDocResponse(raw: ICountRawDocResponse): CreateDocumentResponse {
    return {
      id: String(raw.doc_id || raw.docnum || ""),
      number: String(raw.docnum || raw.doc_id || ""),
      url: String(raw.doc_url || ""),
      pdfUrl: raw.pdf_url ? String(raw.pdf_url) : undefined,
      amount: Number(raw.total || 0),
    };
  }

  async createReceipt(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    const docData = this.buildDocumentData({ ...request, docType: "receipt" });
    const raw = await this.request<ICountRawDocResponse>("doc/create", docData);
    return this.normalizeDocResponse(raw);
  }

  async createInvoice(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    const docData = this.buildDocumentData({ ...request, docType: "tax_invoice" });
    const raw = await this.request<ICountRawDocResponse>("doc/create", docData);
    return this.normalizeDocResponse(raw);
  }

  async createInvoiceReceipt(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    const docData = this.buildDocumentData({ ...request, docType: "invoice_receipt" });
    const raw = await this.request<ICountRawDocResponse>("doc/create", docData);
    return this.normalizeDocResponse(raw);
  }

  async getDocumentUrl(docId: string): Promise<string> {
    const data = await this.request<{ doc_url?: string }>("doc/get", { doc_id: docId });
    return data.doc_url || "";
  }

  async createQuote(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    const docData = this.buildDocumentData({ ...request, docType: "quote" });
    const raw = await this.request<ICountRawDocResponse>("doc/create", docData);
    return this.normalizeDocResponse(raw);
  }

  async createCreditNote(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    const docData = this.buildDocumentData({ ...request, docType: "credit_note" });
    const raw = await this.request<ICountRawDocResponse>("doc/create", docData);
    return this.normalizeDocResponse(raw);
  }

  async getDocuments(filters?: { doctype?: number; from_date?: string; to_date?: string }): Promise<ICountRawDocResponse[]> {
    const data = await this.request<ICountRawDocResponse[] | { docs?: ICountRawDocResponse[] }>("doc/get_list", filters || {});
    if (Array.isArray(data)) return data;
    return (data as { docs?: ICountRawDocResponse[] }).docs || [];
  }

  // ===== Payment Pages (Clearing) =====

  async createPaymentPage(request: CreatePaymentPageRequest): Promise<CreatePaymentPageResponse> {
    const items = request.items.map((item, i) => ({
      [`description_${i + 1}`]: item.description,
      [`quantity_${i + 1}`]: item.quantity,
      [`unitprice_${i + 1}`]: item.unitprice,
    }));

    const flatItems: Record<string, unknown> = {};
    for (const item of items) {
      Object.assign(flatItems, item);
    }

    const data = await this.request<{ paypage_url?: string; paypage_id?: number; payment_url?: string; page_id?: string }>(
      "paypage/create",
      {
        page_name: request.pageName || "MotyPlus - תשלום",
        client_name: request.customer.client_name,
        email: request.customer.email,
        phone: request.customer.phone,
        ...flatItems,
        items_count: request.items.length,
        currency_code: request.currency || "ILS",
        lang: request.lang || "he",
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
        webhook_url: request.webhookUrl,
        auto_create_doc: request.autoCreateDoc ?? true,
        doctype: request.docType ? this.mapDocType(request.docType) : "invrec",
        ...(request.metadata
          ? { custom_fields: JSON.stringify(request.metadata) }
          : {}),
      }
    );

    return {
      url: data.paypage_url || data.payment_url || "",
      pageId: String(data.paypage_id || data.page_id || ""),
    };
  }
}

export function createICountClient(
  companyId: string,
  credentials: string,
  settings?: ICountSettings
): ICountClient {
  return new ICountClient(companyId, credentials, settings);
}
