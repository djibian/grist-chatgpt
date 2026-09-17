import { evaluateLogtoDiscovery } from "../src/compat/logtoMcp.js";

function usage(): never {
  console.error(
    "Usage: npm run probe:logto -- metadata --issuer https://auth.example.org/oidc"
  );
  process.exit(2);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value?.trim() || undefined;
}

function discoveryUrl(issuer: string): string {
  const parsed = new URL(issuer);
  if (parsed.protocol !== "https:") {
    throw new Error("Issuer must use HTTPS for the POC.");
  }
  parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/.well-known/openid-configuration`;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

async function main(): Promise<void> {
  if (process.argv[2] !== "metadata") usage();
  const issuer = option("--issuer");
  if (!issuer) usage();

  const response = await fetch(discoveryUrl(issuer), {
    signal: AbortSignal.timeout(10_000),
    headers: { accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Discovery request failed with HTTP ${response.status}.`);
  }

  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Discovery response is not a JSON object.");
  }

  const report = evaluateLogtoDiscovery(
    issuer.replace(/\/$/, ""),
    body as Record<string, unknown>
  );

  console.log(JSON.stringify(report, null, 2));
  if (report.checks.some((check) => check.status === "FAIL")) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown probe failure";
  console.error(`Logto metadata probe failed: ${message}`);
  process.exitCode = 1;
});
