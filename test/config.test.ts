import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.js";

function withEnv(
  overrides: Record<string, string | undefined>,
  fn: () => void
): void {
  const original = { ...process.env };
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    fn();
  } finally {
    process.env = original;
  }
}

const BASE_ENV = {
  GRIST_BASE_URL: "https://grist.example.org",
  GRIST_API_KEY: "test-key",
  GRIST_ALLOWED_DOCUMENT_IDS: "doc-1",
  MCP_BEARER_TOKEN: "0123456789abcdef0123456789abcdef",
  GPT_ACTION_TOKEN: "abcdef0123456789abcdef0123456789",
  HOST: "127.0.0.1",
  PORT: "3000"
};

test("adds configured public MCP hosts while preserving localhost", () => {
  withEnv(
    {
      ...BASE_ENV,
      MCP_ALLOWED_HOSTS: "grist-chatgpt.loeildumaitre.fr,mcp.example.org"
    },
    () => {
      const config = loadConfig();
      assert.deepEqual(config.mcpAllowedHosts, [
        "127.0.0.1",
        "localhost",
        "[::1]",
        "grist-chatgpt.loeildumaitre.fr",
        "mcp.example.org"
      ]);
    }
  );
});

test("rejects URLs in MCP_ALLOWED_HOSTS", () => {
  withEnv(
    {
      ...BASE_ENV,
      MCP_ALLOWED_HOSTS: "https://grist-chatgpt.loeildumaitre.fr"
    },
    () => {
      assert.throws(
        () => loadConfig(),
        /MCP_ALLOWED_HOSTS must contain hostnames only/
      );
    }
  );
});

test("requires a strong independent GPT Actions token", () => {
  withEnv(
    {
      ...BASE_ENV,
      GPT_ACTION_TOKEN: "too-short"
    },
    () => {
      assert.throws(
        () => loadConfig(),
        /GPT_ACTION_TOKEN must be at least 32 characters long/
      );
    }
  );

  withEnv(
    {
      ...BASE_ENV,
      GPT_ACTION_TOKEN: BASE_ENV.MCP_BEARER_TOKEN
    },
    () => {
      assert.throws(
        () => loadConfig(),
        /GPT_ACTION_TOKEN must differ from MCP_BEARER_TOKEN/
      );
    }
  );
});
