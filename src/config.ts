export interface Config {
  gristBaseUrl: string;
  gristApiKey: string;
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

export function loadConfig(): Config {
  const port = Number(process.env.PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  const host = process.env.HOST?.trim() || "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      "V0 intentionally binds only to localhost. Remote deployment is a later security milestone."
    );
  }

  return {
    gristBaseUrl: normalizeBaseUrl(required("GRIST_BASE_URL")),
    gristApiKey: required("GRIST_API_KEY"),
    host,
    port
  };
}
