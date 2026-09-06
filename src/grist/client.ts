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
  private readonly apiKey: string;

  constructor(options: GristClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
  }

  async listTables(documentId: string): Promise<unknown> {
    return this.request(
      `/api/docs/${encodeURIComponent(documentId)}/tables`
    );
  }

  async queryRecords(
    documentId: string,
    tableId: string,
    options: {
      filter?: Record<string, unknown[]>;
      limit?: number;
    } = {}
  ): Promise<unknown> {
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
    documentId: string,
    tableId: string,
    records: NewGristRecord[]
  ): Promise<unknown> {
    return this.request(
      `/api/docs/${encodeURIComponent(documentId)}/tables/${encodeURIComponent(tableId)}/records`,
      {
        method: "POST",
        body: JSON.stringify({ records })
      }
    );
  }

  async updateRecords(
    documentId: string,
    tableId: string,
    records: UpdateGristRecord[]
  ): Promise<unknown> {
    return this.request(
      `/api/docs/${encodeURIComponent(documentId)}/tables/${encodeURIComponent(tableId)}/records`,
      {
        method: "PATCH",
        body: JSON.stringify({ records })
      }
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
