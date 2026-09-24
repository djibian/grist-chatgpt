export interface NewGristRecord {
  fields: Record<string, unknown>;
}

export interface UpdateGristRecord extends NewGristRecord {
  id: number;
}

export interface GristColumnSpec {
  id: string;
  fields?: Record<string, unknown> | undefined;
}

export interface GristColumnUpdate {
  id: string;
  fields: Record<string, unknown>;
}

export interface GristTableSpec {
  id: string;
  columns?: GristColumnSpec[] | undefined;
}

export interface GristTableUpdate {
  id: string;
  fields: Record<string, unknown>;
}

export interface GristOrgSummary {
  id: string | number;
  name?: string;
  domain?: string | null;
  access?: string;
  [key: string]: unknown;
}

export interface GristDocumentSummary {
  id: string | number;
  name?: string;
  urlId?: string | null;
  access?: string;
  [key: string]: unknown;
}

export interface GristWorkspaceSummary {
  id: string | number;
  name?: string;
  access?: string;
  docs?: GristDocumentSummary[];
  orgDomain?: string;
  [key: string]: unknown;
}

interface GristClientOptions {
  baseUrl: string;
  apiKey: string;
}

export type GristEffectKnowledge = "NOT_APPLIED" | "UNCERTAIN";

export class GristApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody?: string,
    public readonly effectKnowledge: GristEffectKnowledge = "NOT_APPLIED"
  ) {
    super(message);
    this.name = "GristApiError";
  }
}

export class GristTransportError extends Error {
  constructor(
    message: string,
    public readonly effectKnowledge: GristEffectKnowledge,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "GristTransportError";
  }
}

export function isUncertainGristEffect(error: unknown): boolean {
  return (
    (error instanceof GristApiError || error instanceof GristTransportError) &&
    error.effectKnowledge === "UNCERTAIN"
  );
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

  async listOrgs(): Promise<GristOrgSummary[]> {
    return (await this.request("/api/orgs")) as GristOrgSummary[];
  }

  async listWorkspaces(orgId: string | number): Promise<GristWorkspaceSummary[]> {
    return (await this.request(
      `/api/orgs/${encodeURIComponent(String(orgId))}/workspaces`
    )) as GristWorkspaceSummary[];
  }

  async listTables(
    documentIdOrUrl: string,
    options: { expandColumns?: boolean } = {}
  ): Promise<unknown> {
    const documentId = this.normalizeDocumentId(documentIdOrUrl);
    const suffix = options.expandColumns ? "?expand=column" : "";
    return this.request(
      `/api/docs/${encodeURIComponent(documentId)}/tables${suffix}`
    );
  }

  async createTables(
    documentIdOrUrl: string,
    tables: GristTableSpec[]
  ): Promise<unknown> {
    const documentId = this.normalizeDocumentId(documentIdOrUrl);
    return this.request(`/api/docs/${encodeURIComponent(documentId)}/tables`, {
      method: "POST",
      body: JSON.stringify({ tables })
    });
  }

  async updateTables(
    documentIdOrUrl: string,
    tables: GristTableUpdate[]
  ): Promise<unknown> {
    const documentId = this.normalizeDocumentId(documentIdOrUrl);
    return this.request(`/api/docs/${encodeURIComponent(documentId)}/tables`, {
      method: "PATCH",
      body: JSON.stringify({ tables })
    });
  }

  async listColumns(
    documentIdOrUrl: string,
    tableId: string,
    options: { hidden?: boolean } = {}
  ): Promise<unknown> {
    const documentId = this.normalizeDocumentId(documentIdOrUrl);
    const query = new URLSearchParams();
    if (options.hidden !== undefined) query.set("hidden", String(options.hidden));
    const suffix = query.size ? `?${query.toString()}` : "";
    return this.request(
      `/api/docs/${encodeURIComponent(documentId)}/tables/${encodeURIComponent(tableId)}/columns${suffix}`
    );
  }

  async createColumns(
    documentIdOrUrl: string,
    tableId: string,
    columns: GristColumnSpec[]
  ): Promise<unknown> {
    const documentId = this.normalizeDocumentId(documentIdOrUrl);
    return this.request(
      `/api/docs/${encodeURIComponent(documentId)}/tables/${encodeURIComponent(tableId)}/columns`,
      {
        method: "POST",
        body: JSON.stringify({ columns })
      }
    );
  }

  async updateColumns(
    documentIdOrUrl: string,
    tableId: string,
    columns: GristColumnUpdate[]
  ): Promise<unknown> {
    const documentId = this.normalizeDocumentId(documentIdOrUrl);
    return this.request(
      `/api/docs/${encodeURIComponent(documentId)}/tables/${encodeURIComponent(tableId)}/columns`,
      {
        method: "PATCH",
        body: JSON.stringify({ columns })
      }
    );
  }

  async deleteColumn(
    documentIdOrUrl: string,
    tableId: string,
    columnId: string
  ): Promise<unknown> {
    const documentId = this.normalizeDocumentId(documentIdOrUrl);
    return this.request(
      `/api/docs/${encodeURIComponent(documentId)}/tables/${encodeURIComponent(tableId)}/columns/${encodeURIComponent(columnId)}`,
      { method: "DELETE" }
    );
  }

  async applyUserActions(
    documentIdOrUrl: string,
    actions: unknown[][]
  ): Promise<unknown> {
    const documentId = this.normalizeDocumentId(documentIdOrUrl);
    return this.request(`/api/docs/${encodeURIComponent(documentId)}/apply`, {
      method: "POST",
      body: JSON.stringify(actions)
    });
  }

  async queryRecords(
    documentIdOrUrl: string,
    tableId: string,
    options: {
      filter?: Record<string, unknown[]>;
      sort?: string;
      limit?: number;
      hidden?: boolean;
      cellFormat?: "normal" | "typed";
    } = {}
  ): Promise<unknown> {
    const documentId = this.normalizeDocumentId(documentIdOrUrl);
    const query = new URLSearchParams();

    if (options.filter) query.set("filter", JSON.stringify(options.filter));
    if (options.sort) query.set("sort", options.sort);
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    if (options.hidden !== undefined) query.set("hidden", String(options.hidden));
    if (options.cellFormat) query.set("cellFormat", options.cellFormat);

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

  async deleteRecords(
    documentIdOrUrl: string,
    tableId: string,
    recordIds: number[]
  ): Promise<unknown> {
    const documentId = this.normalizeDocumentId(documentIdOrUrl);
    return this.request(
      `/api/docs/${encodeURIComponent(documentId)}/tables/${encodeURIComponent(tableId)}/records/delete`,
      {
        method: "POST",
        body: JSON.stringify(recordIds)
      }
    );
  }

  normalizeDocumentId(value: string): string {
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
    const method = (init.method ?? "GET").toUpperCase();
    const mayMutate = method !== "GET" && method !== "HEAD";
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers
        },
        signal: AbortSignal.timeout(10_000)
      });
    } catch (cause) {
      throw new GristTransportError(
        "Grist API request failed before an HTTP response was received.",
        mayMutate ? "UNCERTAIN" : "NOT_APPLIED",
        cause
      );
    }

    let body: string;
    try {
      body = await response.text();
    } catch (cause) {
      throw new GristTransportError(
        "Grist API response body could not be read.",
        mayMutate ? "UNCERTAIN" : "NOT_APPLIED",
        cause
      );
    }

    if (!response.ok) {
      throw new GristApiError(
        `Grist API request failed with HTTP ${response.status}`,
        response.status,
        body.slice(0, 1000),
        mayMutate ? "UNCERTAIN" : "NOT_APPLIED"
      );
    }

    if (!body) return null;

    try {
      return JSON.parse(body);
    } catch {
      throw new GristApiError(
        "Grist API returned a non-JSON response.",
        response.status,
        body.slice(0, 1000),
        mayMutate ? "UNCERTAIN" : "NOT_APPLIED"
      );
    }
  }
}
