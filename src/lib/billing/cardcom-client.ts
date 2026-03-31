// ===== CardCom Client — מימוש BillingClient =====

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
} from "./types";

interface CardComConfig {
  apiName: string;
  apiPassword: string;
  terminalNumber: string;
}

const BASE_URL = "https://secure.cardcom.solutions/api/v11";

export class CardComClient implements BillingClient {
  private config: CardComConfig;

  constructor(authJson: string) {
    this.config = JSON.parse(authJson) as CardComConfig;
  }

  // ===== Mapping helpers =====

  private static mapDocType(dt: DocumentType): number {
    const map: Record<DocumentType, number> = {
      tax_invoice: 300,
      invoice_receipt: 305,
      receipt: 320,
      credit_note: 330,
      quote: 200,
    };
    return map[dt] ?? 305;
  }

  private static mapCurrency(currency?: string): number {
    const map: Record<string, number> = { ILS: 1, USD: 2, EUR: 978 };
    return map[currency?.toUpperCase() || "ILS"] || 1;
  }

  // ===== HTTP helper =====

  private async request<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${BASE_URL}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          TerminalNumber: Number(this.config.terminalNumber),
          ApiName: this.config.apiName,
          ApiPassword: this.config.apiPassword,
          ...body,
        }),
        signal: controller.signal,
      });

      const data = (await res.json()) as T;
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("CardCom request timeout (30s)");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ===== BillingClient implementation =====

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.request<{ ResponseCode?: number; Description?: string }>(
        "Documents/GetReport",
        {
          FromDate: "2020-01-01",
          ToDate: "2020-01-02",
        }
      );
      // ResponseCode 0 = success, but even other codes mean auth worked
      if (result.ResponseCode !== undefined && result.ResponseCode <= 0) {
        return { success: true };
      }
      // If we got a response at all, connection works
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async createCustomer(customer: BillingCustomer): Promise<string> {
    // CardCom doesn't have dedicated customer management.
    // Customers are created inline with documents/transactions.
    return customer.id || `cardcom_${Date.now()}`;
  }

  async updateCustomer(_clientId: string, _customer: Partial<BillingCustomer>): Promise<void> {
    // CardCom doesn't maintain customer records — no-op
  }

  async createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    const totalAmount = request.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const invoiceLines = request.items.map((item, i) => ({
      [`InvoiceLines${i + 1}.Description`]: item.description,
      [`InvoiceLines${i + 1}.Price`]: item.unitPrice,
      [`InvoiceLines${i + 1}.Quantity`]: item.quantity,
      [`InvoiceLines${i + 1}.IsPriceIncludeVAT`]: true,
    }));

    // Flatten invoice lines into a single object
    const flatLines: Record<string, unknown> = {};
    for (const line of invoiceLines) {
      Object.assign(flatLines, line);
    }

    const body: Record<string, unknown> = {
      InvoiceHead: {
        CustName: request.customer.name,
        CustAddresLine1: request.customer.address || "",
        CustCity: request.customer.city || "",
        CompID: request.customer.vatId || "",
        Email: request.customer.email || "",
        CustMobilePH: request.customer.phone || "",
        Language: request.lang === "en" ? "en" : "he",
        SendByEmail: request.sendEmail ?? true,
        CoinID: CardComClient.mapCurrency(request.currency),
      },
      InvoiceLines: request.items.map((item) => ({
        Description: item.description,
        Price: item.unitPrice,
        Quantity: item.quantity,
        IsPriceIncludeVAT: true,
      })),
      InvoiceType: CardComClient.mapDocType(request.docType),
    };

    // Add payment info for receipt-type documents
    if (
      request.docType === "receipt" ||
      request.docType === "invoice_receipt"
    ) {
      if (request.paymentType === "cash") {
        body.Cash = totalAmount;
      }
    }

    const result = await this.request<{
      ResponseCode?: number;
      InvoiceNumber?: number;
      InvoiceType?: number;
      DocumentUrl?: string;
      Description?: string;
    }>("Documents/CreateDocument", body);

    if (result.ResponseCode && result.ResponseCode !== 0) {
      throw new Error(result.Description || `CardCom error: ${result.ResponseCode}`);
    }

    return {
      id: String(result.InvoiceNumber || ""),
      number: String(result.InvoiceNumber || ""),
      url: result.DocumentUrl || "",
      amount: totalAmount,
    };
  }

  async getDocument(docId: string): Promise<DocumentInfo> {
    const result = await this.request<{
      ResponseCode?: number;
      Url?: string;
      Description?: string;
    }>("Documents/CreateDocumentUrl", {
      DocumentNumber: Number(docId),
    });

    return {
      docUrl: result.Url || "",
      pdfUrl: result.Url || "",
      docNumber: docId,
    };
  }

  async getDocuments(filters?: DocumentFilters): Promise<RawDocument[]> {
    const now = new Date();
    const body: Record<string, unknown> = {
      FromDate: filters?.fromDate || "2020-01-01",
      ToDate: filters?.toDate || now.toISOString().slice(0, 10),
    };

    if (filters?.docType) {
      const typeMap: Record<string, number> = {
        receipt: 320,
        invoice: 300,
        tax_invoice: 300,
        invoice_receipt: 305,
        invrec: 305,
        credit_note: 330,
        quote: 200,
      };
      const mapped = typeMap[filters.docType];
      if (mapped) body.InvoiceType = mapped;
    }

    const result = await this.request<{
      ResponseCode?: number;
      Documents?: Array<{
        InvoiceNumber?: number;
        InvoiceType?: number;
        TotalIncludeVAT?: number;
        CustName?: string;
        InvoiceDate?: string;
        DocumentUrl?: string;
        [key: string]: unknown;
      }>;
      Description?: string;
    }>("Documents/GetReport", body);

    const docs = result.Documents || [];
    return docs.map((doc) => ({
      doc_id: String(doc.InvoiceNumber || ""),
      docnum: String(doc.InvoiceNumber || ""),
      doctype: String(doc.InvoiceType || ""),
      doc_url: doc.DocumentUrl || "",
      client_name: doc.CustName || "",
      client_id: 0,
      total: doc.TotalIncludeVAT || 0,
      totalwithvat: doc.TotalIncludeVAT || 0,
      dateissued: doc.InvoiceDate || "",
    }));
  }

  async createPaymentPage(
    request: CreatePaymentPageRequest
  ): Promise<PaymentPageResponse> {
    const totalAmount = request.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const body: Record<string, unknown> = {
      SumToBill: totalAmount,
      SuccessRedirectUrl: request.successUrl,
      FailedRedirectUrl: request.cancelUrl,
      IndicatorUrl: request.webhookUrl || "",
      ReturnValue: request.metadata ? JSON.stringify(request.metadata) : "",
      Language: request.lang === "en" ? "en" : "he",
      CoinID: CardComClient.mapCurrency(request.currency),
      MaxNumOfPayments: 1,
    };

    // Auto-create document on payment — CardCom expects flat InvoiceLines at top level
    if (request.autoCreateDoc !== false) {
      body["InvoiceHead.CustName"] = request.customer.name;
      body["InvoiceHead.CustAddresLine1"] = request.customer.address || "";
      body["InvoiceHead.CustCity"] = request.customer.city || "";
      body["InvoiceHead.Email"] = request.customer.email || "";
      body["InvoiceHead.CustMobilePH"] = request.customer.phone || "";
      body["InvoiceHead.Language"] = request.lang === "en" ? "en" : "he";
      body["InvoiceHead.SendByEmail"] = true;
      body["InvoiceHead.CoinID"] = CardComClient.mapCurrency(request.currency);

      request.items.forEach((item, i) => {
        const idx = i + 1;
        body[`InvoiceLines${idx}.Description`] = item.description;
        body[`InvoiceLines${idx}.Price`] = item.unitPrice;
        body[`InvoiceLines${idx}.Quantity`] = item.quantity;
        body[`InvoiceLines${idx}.IsPriceIncludeVAT`] = true;
      });

      body.InvoiceType = request.docType
        ? CardComClient.mapDocType(request.docType)
        : 305;
    }

    const result = await this.request<{
      ResponseCode?: number;
      LowProfileId?: string;
      Url?: string;
      Description?: string;
    }>("LowProfile/Create", body);

    if (result.ResponseCode && result.ResponseCode !== 0) {
      throw new Error(result.Description || `CardCom LowProfile error: ${result.ResponseCode}`);
    }

    return {
      url: result.Url || "",
      pageId: result.LowProfileId || "",
    };
  }
}
