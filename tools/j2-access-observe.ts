import { GristApiError, GristClient } from "../src/grist/client.js";
import { observeJ2FixtureAccess } from "../src/j2/fixtureAccessObservation.js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function boundedOrigin(value: string): string {
  const parsed = new URL(value);
  const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (
    (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("J2 Grist origin must be an HTTPS origin or a local HTTP origin.");
  }
  return parsed.origin;
}

async function main(): Promise<void> {
  const origin = boundedOrigin(requiredEnv("J2_GRIST_BASE_URL"));
  const apiKey = requiredEnv("J2_GRIST_OWNER_API_KEY");
  const documentId = requiredEnv("J2_FIXTURE_DOCUMENT_ID");
  const client = new GristClient({ baseUrl: origin, apiKey });
  const evidence = await observeJ2FixtureAccess(client, documentId);
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

main().catch((error: unknown) => {
  // Grist error bodies and URLs may contain sensitive data. Never print them here.
  const status = error instanceof GristApiError ? ` (HTTP ${error.status})` : "";
  process.stderr.write(`J2-A fixture observation failed${status}; check the dedicated owner credential, exact fixture ID and internal metadata access.\n`);
  process.exitCode = 1;
});
