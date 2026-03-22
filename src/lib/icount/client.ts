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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid: this.companyId,
          user: this.username,
          pass: this.password,
        }),
        signal: controller.signal,
      });

      const data = (await res.json()) as ICountResponse<{ sid?: string }>;
      // Support both { status: true, data: { sid: "..." } } and { status: true, sid: "..." }
      const sid = data.data?.sid ?? (data as { sid?: string }).sid;
      if (!data.status || !sid) {
        throw new Error(data.reason || data.error_description || "iCount login failed");
      }

      this.sid = sid;
      return this.sid;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("iCount login timeout (30s)");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const authParams = this.getAuthParams();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.apiToken) {
        headers["Authorization"] = `Bearer ${this.apiToken}`;
      }
      const res = await fetch(`${BASE_URL}/${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...body, ...authParams }),
        signal: controller.signal,
      });

      const data = (await res.json()) as ICountResponse<T>;

      // Session expired — retry once (only for SID mode)
      if (!this.apiToken && !data.status && (data.reason?.includes("session") || data.reason?.includes("sid"))) {
        this.sid = null;
        await this.login();

        const retryAuthParams = this.getAuthParams();
        const retryHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (this.apiToken) {
          retryHeaders["Authorization"] = `Bearer ${this.apiToken}`;
        }

        const retryRes = await fetch(`${BASE_URL}/${endpoint}`, {
          method: "POST",
          headers: retryHeaders,
          body: JSON.stringify({ ...body, ...retryAuthParams }),
          signal: controller.signal,
        });
        const retryData = (await retryRes.json()) as ICountResponse<T>;
        if (!retryData.status) {
          throw new Error(retryData.reason || retryData.error_description || "iCount request failed");
        }
        // Use consistent fallback pattern (root level or nested)
        return (retryData.data || retryData) as T;
      }

      if (!data.status) {
        throw new Error(data.reason || data.error_description || "iCount request failed");
      }

      // iCount returns fields at root level, not nested in data
      return (data.data || data) as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("iCount request timeout (30s)");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ===== Connection Test =====

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Test connection by fetching available doc types
      await this.getAvailableDocTypes();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async getAvailableDocTypes(): Promise<string[]> {
    try {
      if (this.apiToken) {
        // Bearer token mode — use doc/get_doc_types
        const data = await this.request<Record<string, unknown> | string[]>(
          "doc/get_doc_types",
          {}
        );
        // Response could be an object or array depending on iCount version
        if (Array.isArray(data)) {
          return data.map(String);
        }
        // If it's an object, return the keys
        if (typeof data === "object" && data !== null) {
          return Object.keys(data);
        }
        return [];
      } else {
        // SID mode — use doc/types
        const data = await this.request<{ doctypes?: Record<string, unknown> }>(
          "doc/types",
          {}
        );
        return data.doctypes ? Object.keys(data.doctypes) : [];
      }
    } catch (error) {
      console.error("Error fetching available doc types:", error);
      return [];
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
      invoice_receipt: "invrec", // חשבונית מס-קבלה (קוד 320) — עם תשלום
      credit_note: "creditnote",
      quote: "offer", // iCount uses "offer" not "quote"
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
      ...(request.customer.client_id ? { client_id: request.customer.client_id } : {}),
      email: request.customer.email,
      phone: request.customer.phone,
      ...(request.customer.address ? { address: request.customer.address } : {}),
      ...(request.customer.city ? { city: request.customer.city } : {}),
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

  async getDocument(docId: string): Promise<{ doc_url: string; pdf_url: string; docnum: string }> {
    const data = await this.request<{ doc_url?: string; pdf_url?: string; docnum?: string }>("doc/get", { doc_id: docId });
    return {
      doc_url: String(data.doc_url || ""),
      pdf_url: String(data.pdf_url || ""),
      docnum: String(data.docnum || ""),
    };
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

  async getDocuments(filters?: { doctype?: string; from_date?: string; to_date?: string }): Promise<ICountRawDocResponse[]> {
    // iCount uses doc/search with Bearer auth
    // detail_level: 10 returns full data including doc_url, client_name, items
    // Must have at least doctype to avoid empty_query error
    const searchParams: Record<string, unknown> = { detail_level: 10 };
    if (filters?.doctype) searchParams.doctype = filters.doctype;
    if (filters?.from_date) searchParams.from_date = filters.from_date;
    if (filters?.to_date) searchParams.to_date = filters.to_date;

    // If no filters, search all common doctypes
    if (!searchParams.doctype) {
      const allDocs: ICountRawDocResponse[] = [];
      for (const dt of ["invoice", "receipt", "invrec", "offer"]) {
        try {
          const data = await this.request<{ results_list?: ICountRawDocResponse[] }>("doc/search", { ...searchParams, doctype: dt });
          if (data.results_list) allDocs.push(...data.results_list);
        } catch { /* skip if type not supported */ }
      }
      return allDocs;
    }

    const data = await this.request<{ results_list?: ICountRawDocResponse[] }>("doc/search", searchParams);
    return data.results_list || [];
  }

  // ===== Payment Pages (Clearing) =====

  async createPaymentPage(request: CreatePaymentPageRequest): Promise<CreatePaymentPageResponse> {
    // iCount paypage uses items array with desc/quantity/unitprice keys
    // Mark items as VAT exempt (vat_type: 0) so no VAT is added
    const items = request.items.map((item) => ({
      desc: item.description,
      quantity: item.quantity,
      unitprice: item.unitprice,
      vat_type: 0,
    }));

    // Calculate total for cs (custom sum) fallback
    const totalSum = request.items.reduce((sum, item) => sum + item.quantity * item.unitprice, 0);
    const firstDesc = request.items[0]?.description || "תשלום";

    const data = await this.request<{ paypage_url?: string; paypage_id?: number; payment_url?: string; page_id?: string; sale_url?: string }>(
      "paypage/create",
      {
        page_name: request.pageName || "Motty Beats - תשלום",
        // Customer info — iCount uses full_name/contact_email/contact_phone
        client_name: request.customer.client_name,
        full_name: request.customer.client_name,
        email: request.customer.email,
        contact_email: request.customer.email,
        phone: request.customer.phone,
        contact_phone: request.customer.phone,
        // Items — both formats for compatibility
        items,
        // Also send cs/cd (custom sum/description) as fallback
        cs: totalSum,
        cd: firstDesc,
        currency_code: request.currency || "ILS",
        lang: request.lang || "he",
        success_url: request.successUrl,
        failure_url: request.cancelUrl,
        cancel_url: request.cancelUrl,
        ipn_url: request.webhookUrl,
        webhook_url: request.webhookUrl,
        auto_create_doc: 1,
        doctype: request.docType ? this.mapDocType(request.docType) : "invrec",
        // VAT settings — multiple approaches for compatibility
        vat_exempt: 1,
        include_vat: 0,
        price_include_vat: 1,
        no_vat: 1,
        vat_percent: 0,
        // No max_payments — leave unlimited
        // Hidden metadata — m__ prefix fields are returned in IPN without the prefix
        ...(request.metadata
          ? Object.fromEntries(
              Object.entries(request.metadata).map(([k, v]) => [`m__${k}`, v])
            )
          : {}),
      }
    );

    return {
      url: data.paypage_url || data.payment_url || data.sale_url || "",
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
