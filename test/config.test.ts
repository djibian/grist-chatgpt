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
  GRIST_ALLOWED_WORKSPACE_IDS: undefined,
  GRIST_MAX_READ_RECORDS: undefined,
  GRIST_MAX_WRITE_RECORDS: undefined,
  MCP_AUTH_MODE: undefined,
  MCP_BEARER_TOKEN: "0123456789abcdef0123456789abcdef",
  OAUTH_ISSUER: undefined,
  OAUTH_JWKS_URI: undefined,
  MCP_RESOURCE_URI: undefined,
  GPT_ACTION_TOKEN: "abcdef0123456789abcdef0123456789",
  HOST: "127.0.0.1",
  PORT: "3000"
};

test("defaults MCP authentication to the existing static bearer mode", () => {
  withEnv(BASE_ENV, () => {
    const config = loadConfig();
    assert.deepEqual(config.mcpAuth, {
      mode: "static",
      bearerToken: BASE_ENV.MCP_BEARER_TOKEN
    });
  });
});

test("loads provider-neutral OAuth MCP configuration", () => {
  withEnv(
    {
      ...BASE_ENV,
      MCP_AUTH_MODE: "oauth",
      MCP_BEARER_TOKEN: undefined,
      OAUTH_ISSUER: "https://auth.example.test/oidc",
      OAUTH_JWKS_URI: "https://auth.example.test/oidc/jwks",
      MCP_RESOURCE_URI: "https://mcp.example.test/mcp"
    },
    () => {
      const config = loadConfig();
      assert.deepEqual(config.mcpAuth, {
        mode: "oauth",
        issuer: "https://auth.example.test/oidc",
        jwksUri: "https://auth.example.test/oidc/jwks",
        resourceUri: "https://mcp.example.test/mcp"
      });
    }
  );
});

test("OAuth MCP mode rejects any configured static MCP bearer", () => {
  withEnv(
    {
      ...BASE_ENV,
      MCP_AUTH_MODE: "oauth",
      OAUTH_ISSUER: "https://auth.example.test/oidc",
      OAUTH_JWKS_URI: "https://auth.example.test/oidc/jwks",
      MCP_RESOURCE_URI: "https://mcp.example.test/mcp"
    },
    () => {
      assert.throws(
        () => loadConfig(),
        /MCP_BEARER_TOKEN must not be configured when MCP_AUTH_MODE=oauth/
      );
    }
  );
});

test("OAuth MCP mode requires HTTPS issuer, JWKS and resource URLs", () => {
  withEnv(
    {
      ...BASE_ENV,
      MCP_AUTH_MODE: "oauth",
      MCP_BEARER_TOKEN: undefined,
      OAUTH_ISSUER: "http://auth.example.test/oidc",
      OAUTH_JWKS_URI: "https://auth.example.test/oidc/jwks",
      MCP_RESOURCE_URI: "https://mcp.example.test/mcp"
    },
    () => {
      assert.throws(() => loadConfig(), /OAUTH_ISSUER must use HTTPS/);
    }
  );

  withEnv(
    {
      ...BASE_ENV,
      MCP_AUTH_MODE: "oauth",
      MCP_BEARER_TOKEN: undefined,
      OAUTH_ISSUER: "https://auth.example.test/oidc",
      OAUTH_JWKS_URI: undefined,
      MCP_RESOURCE_URI: "https://mcp.example.test/mcp"
    },
    () => {
      assert.throws(
        () => loadConfig(),
        /Missing required environment variable: OAUTH_JWKS_URI/
      );
    }
  );
});

test("rejects unsupported MCP authentication modes", () => {
  withEnv(
    {
      ...BASE_ENV,
      MCP_AUTH_MODE: "automatic"
    },
    () => {
      assert.throws(
        () => loadConfig(),
        /MCP_AUTH_MODE must be either "static" or "oauth"/
      );
    }
  );
});

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

test("accepts document and/or workspace access scopes", () => {
  withEnv(
    {
      ...BASE_ENV,
      GRIST_ALLOWED_DOCUMENT_IDS: undefined,
      GRIST_ALLOWED_WORKSPACE_IDS: "42, 77"
    },
    () => {
      const config = loadConfig();
      assert.deepEqual(config.allowedDocumentIds, []);
      assert.deepEqual(config.allowedWorkspaceIds, ["42", "77"]);
    }
  );

  withEnv(
    {
      ...BASE_ENV,
      GRIST_ALLOWED_DOCUMENT_IDS: undefined,
      GRIST_ALLOWED_WORKSPACE_IDS: undefined
    },
    () => {
      assert.throws(
        () => loadConfig(),
        /Configure at least one GRIST_ALLOWED_DOCUMENT_IDS or GRIST_ALLOWED_WORKSPACE_IDS/
      );
    }
  );
});

test("loads configurable record guardrails and supports zero as unlimited", () => {
  withEnv(
    {
      ...BASE_ENV,
      GRIST_MAX_READ_RECORDS: "12000",
      GRIST_MAX_WRITE_RECORDS: "0"
    },
    () => {
      const config = loadConfig();
      assert.equal(config.maxReadRecords, 12000);
      assert.equal(config.maxWriteRecords, 0);
    }
  );
});
