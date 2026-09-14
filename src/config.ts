export interface Config {
  gristBaseUrl: string;
  gristApiKey: string;
  allowedDocumentIds: readonly string[];
  allowedWorkspaceIds: readonly string[];
  maxReadRecords: number;
  maxWriteRecords: number;
  writeBatchRecords: number;
  maxSchemaItems: number;
  mcpBearerToken: string;
  gptActionToken: string;
  mcpAllowedHosts: readonly string[];
  host: string;
  port: number;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    url.hostname !== "127.0.0.1" &&
    url.hostname !== "localhost"
  ) {
    throw new Error(
      "GRIST_BASE_URL must use HTTPS except for localhost development."
    );
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString().replace(/\/$/, "");
}

function parseCsv(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function parseAllowedDocumentIds(value: string | undefined): string[] {
  const ids = parseCsv(value);
  for (const id of ids) {
    if (/^https?:\/\//i.test(id)) {
      throw new Error(
        "GRIST_ALLOWED_DOCUMENT_IDS must contain document IDs, not URLs."
      );
    }
  }
  return ids;
}

function parseLimit(name: string, defaultValue: number): number {
  const raw = process.env[name]?.trim();
  const value = raw === undefined || raw === "" ? defaultValue : Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer (0 means unlimited).`);
  }
  return value;
}

function parsePositiveInt(name: string, defaultValue: number): number {
  const raw = process.env[name]?.trim();
  const value = raw === undefined || raw === "" ? defaultValue : Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function parseAllowedHosts(value: string | undefined): string[] {
  const hosts = ["127.0.0.1", "localhost", "[::1]"];

  if (value?.trim()) {
    hosts.push(...parseCsv(value));
  }

  for (const host of hosts) {
    if (/^https?:\/\//i.test(host) || host.includes("/")) {
      throw new Error(
        "MCP_ALLOWED_HOSTS must contain hostnames only, not URLs or paths."
      );
    }
  }

  return [...new Set(hosts)];
}

function requiredToken(name: string): string {
  const token = required(name);
  if (token.length < 32) {
    throw new Error(`${name} must be at least 32 characters long.`);
  }
  return token;
}

export function loadConfig(): Config {
  const port = Number(process.env.PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  const host = process.env.HOST?.trim() || "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      "The bridge intentionally binds only to localhost. Use a reverse proxy for remote access."
    );
  }

  const allowedDocumentIds = parseAllowedDocumentIds(
    process.env.GRIST_ALLOWED_DOCUMENT_IDS
  );
  const allowedWorkspaceIds = parseCsv(process.env.GRIST_ALLOWED_WORKSPACE_IDS);
  if (allowedDocumentIds.length === 0 && allowedWorkspaceIds.length === 0) {
    throw new Error(
      "Configure at least one GRIST_ALLOWED_DOCUMENT_IDS or GRIST_ALLOWED_WORKSPACE_IDS entry."
    );
  }

  const mcpBearerToken = requiredToken("MCP_BEARER_TOKEN");
  const gptActionToken = requiredToken("GPT_ACTION_TOKEN");
  if (gptActionToken === mcpBearerToken) {
    throw new Error("GPT_ACTION_TOKEN must differ from MCP_BEARER_TOKEN.");
  }

  return {
    gristBaseUrl: normalizeBaseUrl(required("GRIST_BASE_URL")),
    gristApiKey: required("GRIST_API_KEY"),
    allowedDocumentIds,
    allowedWorkspaceIds,
    maxReadRecords: parseLimit("GRIST_MAX_READ_RECORDS", 5000),
    maxWriteRecords: parseLimit("GRIST_MAX_WRITE_RECORDS", 500),
    writeBatchRecords: parsePositiveInt("GRIST_WRITE_BATCH_RECORDS", 200),
    maxSchemaItems: parseLimit("GRIST_MAX_SCHEMA_ITEMS", 100),
    mcpBearerToken,
    gptActionToken,
    mcpAllowedHosts: parseAllowedHosts(process.env.MCP_ALLOWED_HOSTS),
    host,
    port
  };
}
