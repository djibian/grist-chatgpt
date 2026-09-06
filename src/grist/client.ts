export interface NewGristRecord {
  fields: Record<string, unknown>;
}

export interface UpdateGristRecord extends NewGristRecord {
  id: number;
}

interface GristClientOptions {
  baseUrl: string;
  apiKey: string;
}

export class GristApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = "GristApiError";
  }
}

export class GristClient {
  private readonly baseUrl: string;
  private readonly baseOrigin: string;
  private readonly apiKey: string;

  constructor(options: GristClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.baseOrigin = new URL(this.baseUrl).origin;
    this.apiKey = options.apiKey;
  }

  async listTables(documentIdOrUrl: string): Promise<unknown> {
    const documentId = this.normalizeDocumentId(documentIdOrUrl);
    return this.request(
      `/api/docs/${encodeURIComponent(documentId)}/tables`
    );
  }

  async queryRecords(
    documentIdOrUrl: string,
    tableId: string,
    options: {
      filter?: Record<string, unknown[]>;
      limit?: number;
    } = {}
  ): Promise<unknown> {
    const documentId = this.normalizeDocumentId(documentIdOrUrl);
    const query = new URLSearchParams();

    if (options.filter) {
      query.set("filter", JSON.stringify(options.filter));
    }
    if (options.limit !== undefined) {
      query.set("limit", String(options.limit));
    }

    const suffix = query.size ? `?${query.toString()}` : "";
    return this.request(
      `/api/docs/${encodeURIComponent(documentId)}/tables/${encodeURIComponent(tableId)}/records${suffix}`
    );
  }

  async createRecords(
    documentIdOrUrl: string,
    tableId: string,
    records: NewGristRecord[]
  ): Promise<unknown> {
    const documentId = this.normalizeDocumentId(documentIdOrUrl);
    return this.request(
      `/api/docs/${encodeURIComponent(documentId)}/tables/${encodeURIComponent(tableId)}/records`,
      {
        method: "POST",
        body: JSON.stringify({ records })
      }
    );
  }

  async updateRecords(
    documentIdOrUrl: string,
    tableId: string,
    records: UpdateGristRecord[]
  ): Promise<unknown> {
    const documentId = this.normalizeDocumentId(documentIdOrUrl);
    return this.request(
      `/api/docs/${encodeURIComponent(documentId)}/tables/${encodeURIComponent(tableId)}/records`,
      {
        method: "PATCH",
        body: JSON.stringify({ records })
      }
    );
  }

  private normalizeDocumentId(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error("Grist document ID must not be empty.");
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    const url = new URL(trimmed);
    if (url.origin !== this.baseOrigin) {
      throw new Error(
        "Grist document URL must use the same origin as GRIST_BASE_URL."
      );
    }

    const segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));

    const docIndex = segments.indexOf("doc");
    const documentIdFromDocPath =
      docIndex >= 0 ? segments[docIndex + 1] : undefined;
    if (documentIdFromDocPath) {
      return documentIdFromDocPath;
    }

    const orgIndex = segments.indexOf("o");
    const documentIdFromOrgPath =
      orgIndex >= 0 ? segments[orgIndex + 2] : undefined;
    if (documentIdFromOrgPath) {
      return documentIdFromOrgPath;
    }

    throw new Error(
      "Could not extract a Grist document ID from the supplied URL."
    );
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers
      },
      signal: AbortSignal.timeout(10_000)
    });

    const body = await response.text();

    if (!response.ok) {
      throw new GristApiError(
        `Grist API request failed with HTTP ${response.status}`,
        response.status,
        body.slice(0, 1000)
      );
    }

    if (!body) return null;

    try {
      return JSON.parse(body);
    } catch {
      throw new GristApiError(
        "Grist API returned a non-JSON response.",
        response.status,
        body.slice(0, 1000)
      );
    }
  }
}
