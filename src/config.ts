export interface Config {
  gristBaseUrl: string;
  gristApiKey: string;
  allowedDocumentIds: readonly string[];
  mcpBearerToken: string;
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

function parseAllowedDocumentIds(value: string): string[] {
  const ids = value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    throw new Error("GRIST_ALLOWED_DOCUMENT_IDS must contain at least one document ID.");
  }

  for (const id of ids) {
    if (/^https?:\/\//i.test(id)) {
      throw new Error(
        "GRIST_ALLOWED_DOCUMENT_IDS must contain document IDs, not URLs."
      );
    }
  }

  return [...new Set(ids)];
}

export function loadConfig(): Config {
  const port = Number(process.env.PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  const host = process.env.HOST?.trim() || "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      "The bridge intentionally binds only to localhost. Use a reverse tunnel for remote access."
    );
  }

  const mcpBearerToken = required("MCP_BEARER_TOKEN");
  if (mcpBearerToken.length < 32) {
    throw new Error("MCP_BEARER_TOKEN must be at least 32 characters long.");
  }

  return {
    gristBaseUrl: normalizeBaseUrl(required("GRIST_BASE_URL")),
    gristApiKey: required("GRIST_API_KEY"),
    allowedDocumentIds: parseAllowedDocumentIds(
      required("GRIST_ALLOWED_DOCUMENT_IDS")
    ),
    mcpBearerToken,
    host,
    port
  };
}
