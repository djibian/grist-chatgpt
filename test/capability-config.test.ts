import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.js";

function runWithEnv(
  overrides: Record<string, string | undefined>,
  fn: () => void
): void {
  const original = { ...process.env };
  try {
    Object.assign(process.env, {
      GRIST_BASE_URL: "https://grist.example.org",
      GRIST_API_KEY: "test-key",
      GRIST_ALLOWED_DOCUMENT_IDS: "doc-1",
      GRIST_ALLOWED_WORKSPACE_IDS: "",
      MCP_BEARER_TOKEN: "0123456789abcdef0123456789abcdef",
      GPT_ACTION_TOKEN: "abcdef0123456789abcdef0123456789",
      HOST: "127.0.0.1",
      PORT: "3000"
    });
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fn();
  } finally {
    process.env = original;
  }
}

test("defaults both principals to read, write and schema capabilities", () => {
  runWithEnv(
    { MCP_CAPABILITIES: undefined, GPT_ACTION_CAPABILITIES: undefined },
    () => {
      const config = loadConfig();
      assert.deepEqual(config.mcpCapabilities, [
        "doc:read",
        "doc:write",
        "doc.schema:write"
      ]);
      assert.deepEqual(config.gptActionCapabilities, config.mcpCapabilities);
    }
  );
});

test("accepts restricted capabilities and rejects unknown values", () => {
  runWithEnv({ MCP_CAPABILITIES: "doc:read" }, () => {
    assert.deepEqual(loadConfig().mcpCapabilities, ["doc:read"]);
  });

  runWithEnv({ GPT_ACTION_CAPABILITIES: "doc:read,admin" }, () => {
    assert.throws(() => loadConfig(), /unsupported capability "admin"/);
  });
});
