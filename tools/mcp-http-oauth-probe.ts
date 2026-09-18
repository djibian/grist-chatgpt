import { createServer, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";

const PROTOCOL_VERSION = "2026-07-28";
const POC_DOCUMENT_ID = "poc-oauth-document";
const POC_TABLE_ID = "ProbeTable";
const SYNTHETIC_GRIST_KEY = "poc-synthetic-grist-key";
const SYNTHETIC_GPT_TOKEN = "poc-gpt-action-token-0123456789abcdef";
const STATIC_BEARER_SENTINEL = "poc-static-bearer-0123456789abcdef0123456789abcdef";

type ProbeCase = "valid" | "wrong-audience" | "missing-write";

interface FakeGristState {
  reads: number;
  mutations: number;
  oauthBearerObserved: boolean;
  syntheticGristCredentialObserved: boolean;
}

interface RunningFakeGrist {
  server: Server;
  baseUrl: string;
  state: FakeGristState;
}

interface McpResponse {
  status: number;
  wwwAuthenticate: string;
  body: unknown;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function parseCase(value: string): ProbeCase {
  if (value === "valid" || value === "wrong-audience" || value === "missing-write") {
    return value;
  }
  throw new Error("invalid_probe_case");
}

function printPass(label: string, value: boolean): void {
  console.log(`${label}: ${value ? "PASS" : "FAIL"}`);
}

function printBoolean(label: string, value: boolean): void {
  console.log(`${label}: ${value ? "yes" : "no"}`);
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("listen_failed");
  return address.port;
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function freePort(): Promise<number> {
  const server = createServer();
  const port = await listen(server);
  await closeServer(server);
  return port;
}

async function startFakeGrist(oauthBearer: string): Promise<RunningFakeGrist> {
  const state: FakeGristState = {
    reads: 0,
    mutations: 0,
    oauthBearerObserved: false,
    syntheticGristCredentialObserved: false
  };

  const server = createServer((req, res) => {
    const method = req.method ?? "GET";
    const path = req.url ?? "/";
    const authorization = req.headers.authorization ?? "";
    const isMutation = ["POST", "PATCH", "PUT", "DELETE"].includes(method);

    if (authorization === `Bearer ${oauthBearer}`) {
      state.oauthBearerObserved = true;
    }
    if (authorization === `Bearer ${SYNTHETIC_GRIST_KEY}`) {
      state.syntheticGristCredentialObserved = true;
    }
    if (isMutation) state.mutations += 1;
    else state.reads += 1;

    res.setHeader("content-type", "application/json");

    if (method === "GET" && path === "/api/orgs") {
      res.statusCode = 200;
      res.end(JSON.stringify([{ id: "poc-org", name: "POC", domain: "poc" }]));
      return;
    }

    if (method === "GET" && path === "/api/orgs/poc-org/workspaces") {
      res.statusCode = 200;
      res.end(
        JSON.stringify([
          {
            id: "poc-workspace",
            name: "POC",
            access: "owners",
            docs: [
              {
                id: POC_DOCUMENT_ID,
                name: "POC OAuth document",
                access: "owners"
              }
            ]
          }
        ])
      );
      return;
    }

    res.statusCode = isMutation ? 200 : 404;
    res.end(
      JSON.stringify(
        isMutation ? { records: [{ id: 1 }] } : { error: "not_found" }
      )
    );
  });

  const port = await listen(server);
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`,
    state
  };
}

function childEnvironment(options: {
  fakeGristBaseUrl: string;
  bridgePort: number;
  issuer: string;
  jwksUri: string;
  resourceUri: string;
}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GRIST_BASE_URL: options.fakeGristBaseUrl,
    GRIST_API_KEY: SYNTHETIC_GRIST_KEY,
    GRIST_ALLOWED_DOCUMENT_IDS: POC_DOCUMENT_ID,
    GRIST_ALLOWED_WORKSPACE_IDS: "",
    GRIST_MAX_READ_RECORDS: "50",
    GRIST_MAX_WRITE_RECORDS: "10",
    GRIST_WRITE_BATCH_RECORDS: "10",
    GRIST_MAX_SCHEMA_ITEMS: "10",
    MCP_AUTH_MODE: "oauth",
    OAUTH_ISSUER: options.issuer,
    OAUTH_JWKS_URI: options.jwksUri,
    MCP_RESOURCE_URI: options.resourceUri,
    GPT_ACTION_TOKEN: SYNTHETIC_GPT_TOKEN,
    MCP_ALLOWED_HOSTS: "127.0.0.1,localhost",
    HOST: "127.0.0.1",
    PORT: String(options.bridgePort)
  };
  delete env.MCP_BEARER_TOKEN;
  return env;
}

function startBridge(env: NodeJS.ProcessEnv): ChildProcess {
  return spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "ignore", "ignore"]
  });
}

async function waitForBridge(child: ChildProcess, baseUrl: string): Promise<boolean> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) return false;
    try {
      const response = await fetch(`${baseUrl}/healthz`, {
        signal: AbortSignal.timeout(500)
      });
      if (response.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise<boolean>((resolve) => child.once("exit", () => resolve(true))),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1_000))
  ]);
  if (!exited && child.exitCode === null) child.kill("SIGKILL");
}

function requestMeta(): Record<string, unknown> {
  return {
    "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
    "io.modelcontextprotocol/clientInfo": {
      name: "grist-chatgpt-c4-p0-probe",
      version: "1.0.0"
    },
    "io.modelcontextprotocol/clientCapabilities": {}
  };
}

async function postMcp(options: {
  baseUrl: string;
  bearer?: string;
  method: string;
  params: Record<string, unknown>;
  name?: string;
}): Promise<McpResponse> {
  const headers: Record<string, string> = {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
    "Mcp-Method": options.method
  };
  if (options.name) headers["Mcp-Name"] = options.name;
  if (options.bearer !== undefined) {
    headers.authorization = `Bearer ${options.bearer}`;
  }

  const response = await fetch(`${options.baseUrl}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: options.method,
      params: {
        ...options.params,
        _meta: requestMeta()
      }
    }),
    signal: AbortSignal.timeout(10_000)
  });

  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
  }

  return {
    status: response.status,
    wwwAuthenticate: response.headers.get("www-authenticate") ?? "",
    body
  };
}

function hasJsonRpcResult(response: McpResponse): boolean {
  if (response.status !== 200 || response.body === null || typeof response.body !== "object") {
    return false;
  }
  return Object.hasOwn(response.body, "result");
}

function toolReturnedError(response: McpResponse): boolean {
  if (!hasJsonRpcResult(response)) return false;
  const result = (response.body as { result?: unknown }).result;
  return (
    result !== null &&
    typeof result === "object" &&
    (result as { isError?: unknown }).isError === true
  );
}

function tokenMissingWriteScope(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf8")
    );
    if (payload === null || typeof payload !== "object") return false;
    const scope = (payload as { scope?: unknown }).scope;
    if (typeof scope !== "string") return true;
    return !scope.split(/\s+/).includes("doc:write");
  } catch {
    return false;
  }
}

function tamperSignature(token: string): string {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[2]) return `${token}x`;
  const signature = parts[2];
  const first = signature[0] === "A" ? "B" : "A";
  return `${parts[0]}.${parts[1]}.${first}${signature.slice(1)}`;
}

async function run(): Promise<boolean> {
  const probeCase = parseCase(required("MCP_HTTP_PROBE_CASE"));
  const accessToken = required("OAUTH_ACCESS_TOKEN");
  const issuer = required("OAUTH_ISSUER").replace(/\/$/, "");
  const jwksUri = required("OAUTH_JWKS_URI");
  const resourceUri = required("MCP_RESOURCE_URI");

  const fakeGrist = await startFakeGrist(accessToken);
  const bridgePort = await freePort();
  const bridgeBaseUrl = `http://127.0.0.1:${bridgePort}`;
  const bridge = startBridge(
    childEnvironment({
      fakeGristBaseUrl: fakeGrist.baseUrl,
      bridgePort,
      issuer,
      jwksUri,
      resourceUri
    })
  );

  let success = false;
  try {
    const started = await waitForBridge(bridge, bridgeBaseUrl);
    printPass("MCP OAuth server starts without static bearer", started);
    if (!started) return false;

    const discoverParams = {};

    if (probeCase === "valid") {
      const missing = await postMcp({
        baseUrl: bridgeBaseUrl,
        method: "server/discover",
        params: discoverParams
      });
      const staticBearer = await postMcp({
        baseUrl: bridgeBaseUrl,
        bearer: STATIC_BEARER_SENTINEL,
        method: "server/discover",
        params: discoverParams
      });
      const invalidSignature = await postMcp({
        baseUrl: bridgeBaseUrl,
        bearer: tamperSignature(accessToken),
        method: "server/discover",
        params: discoverParams
      });
      const validDiscover = await postMcp({
        baseUrl: bridgeBaseUrl,
        bearer: accessToken,
        method: "server/discover",
        params: discoverParams
      });
      const listDocuments = await postMcp({
        baseUrl: bridgeBaseUrl,
        bearer: accessToken,
        method: "tools/call",
        name: "list_documents",
        params: {
          name: "list_documents",
          arguments: {}
        }
      });

      const missingRejected =
        missing.status === 401 && missing.wwwAuthenticate.startsWith("Bearer");
      const staticRejected = staticBearer.status === 401;
      const invalidRejected = invalidSignature.status === 401;
      const validAccepted = hasJsonRpcResult(validDiscover);
      const requestContextWorked =
        hasJsonRpcResult(listDocuments) &&
        !toolReturnedError(listDocuments) &&
        fakeGrist.state.reads > 0;
      const credentialBoundary =
        fakeGrist.state.syntheticGristCredentialObserved &&
        !fakeGrist.state.oauthBearerObserved;

      printPass("Missing bearer rejected on /mcp", missingRejected);
      printBoolean("Static bearer can override OAuth principal in OAuth mode", !staticRejected);
      printPass("Invalid-signature bearer rejected on /mcp", invalidRejected);
      printPass("Valid Logto bearer reaches /mcp", validAccepted);
      printPass("Dynamic Principal/context constructed on /mcp", requestContextWorked);
      printBoolean("OAuth bearer reaches fake Grist", fakeGrist.state.oauthBearerObserved);
      printBoolean(
        "Synthetic Grist credential reaches fake Grist",
        fakeGrist.state.syntheticGristCredentialObserved
      );

      success =
        missingRejected &&
        staticRejected &&
        invalidRejected &&
        validAccepted &&
        requestContextWorked &&
        credentialBoundary;
    } else if (probeCase === "wrong-audience") {
      const response = await postMcp({
        baseUrl: bridgeBaseUrl,
        bearer: accessToken,
        method: "server/discover",
        params: discoverParams
      });
      const rejected = response.status === 401;
      printPass("Wrong-resource bearer rejected on /mcp", rejected);
      printBoolean("Wrong-resource request reaches fake Grist", fakeGrist.state.reads > 0 || fakeGrist.state.mutations > 0);
      success = rejected && fakeGrist.state.reads === 0 && fakeGrist.state.mutations === 0;
    } else {
      const missingWrite = tokenMissingWriteScope(accessToken);
      const discover = await postMcp({
        baseUrl: bridgeBaseUrl,
        bearer: accessToken,
        method: "server/discover",
        params: discoverParams
      });
      const createRecords = await postMcp({
        baseUrl: bridgeBaseUrl,
        bearer: accessToken,
        method: "tools/call",
        name: "create_records",
        params: {
          name: "create_records",
          arguments: {
            documentId: POC_DOCUMENT_ID,
            tableId: POC_TABLE_ID,
            records: [{ fields: { Probe: "must-not-be-written" } }]
          }
        }
      });

      const authenticated = hasJsonRpcResult(discover);
      const denied = toolReturnedError(createRecords);
      const noMutation = fakeGrist.state.mutations === 0;
      const credentialBoundary = !fakeGrist.state.oauthBearerObserved;

      printPass("Reduced-scope bearer authenticates on /mcp", authenticated);
      printBoolean("Token missing doc:write", missingWrite);
      printPass("doc:write tool rejected on /mcp", denied && missingWrite);
      console.log(`Fake Grist mutation requests observed: ${fakeGrist.state.mutations}`);
      printBoolean("OAuth bearer reaches fake Grist", fakeGrist.state.oauthBearerObserved);

      success = authenticated && missingWrite && denied && noMutation && credentialBoundary;
    }
  } finally {
    await stopChild(bridge);
    await closeServer(fakeGrist.server);
  }

  return success;
}

try {
  const success = await run();
  if (!success) process.exitCode = 1;
} catch (error) {
  const code = error instanceof Error && /^[a-z0-9_]+$/.test(error.message)
    ? error.message
    : "unexpected";
  console.log(`Failure stage: ${code}`);
  process.exitCode = 1;
}
