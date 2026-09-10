import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";

import express from "express";

import {
  buildOpenApiDocument,
  registerGptActionApi,
  type GristOperations
} from "../src/actions/api.js";

const TOKEN = "abcdef0123456789abcdef0123456789";

function fakeGrist(overrides: Partial<GristOperations> = {}): GristOperations {
  return {
    listTables: async () => ({ tables: [{ id: "Table1" }] }),
    queryRecords: async () => ({ records: [] }),
    createRecords: async () => ({ records: [{ id: 1 }] }),
    updateRecords: async () => null,
    ...overrides
  };
}

async function startApi(
  grist: GristOperations
): Promise<{ baseUrl: string; server: Server }> {
  const app = express();
  app.use(express.json());
  registerGptActionApi(app, { token: TOKEN, grist });

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server
  };
}

async function stop(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("OpenAPI exposes four bounded GPT Actions with correct consequence flags", () => {
  const document = buildOpenApiDocument("https://bridge.example.org") as any;

  assert.equal(document.servers[0].url, "https://bridge.example.org");
  assert.equal(document.components.securitySchemes.bearerAuth.scheme, "bearer");
  assert.equal(
    document.paths["/api/v1/documents/{documentId}/tables"].get.operationId,
    "listGristTables"
  );
  assert.equal(
    document.paths["/api/v1/documents/{documentId}/tables/{tableId}/query"].post[
      "x-openai-isConsequential"
    ],
    false
  );
  assert.equal(
    document.paths["/api/v1/documents/{documentId}/tables/{tableId}/records"].post[
      "x-openai-isConsequential"
    ],
    true
  );
  assert.equal(
    document.paths["/api/v1/documents/{documentId}/tables/{tableId}/records"].patch[
      "x-openai-isConsequential"
    ],
    true
  );
});

test("REST API rejects missing bearer token and accepts the configured token", async () => {
  let calls = 0;
  const { baseUrl, server } = await startApi(
    fakeGrist({
      listTables: async (documentId) => {
        calls += 1;
        return { documentId, tables: [{ id: "MCP_Test" }] };
      }
    })
  );

  try {
    const unauthorized = await fetch(`${baseUrl}/api/v1/documents/doc-1/tables`);
    assert.equal(unauthorized.status, 401);
    assert.equal(calls, 0);

    const authorized = await fetch(`${baseUrl}/api/v1/documents/doc-1/tables`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    assert.equal(authorized.status, 200);
    assert.deepEqual(await authorized.json(), {
      documentId: "doc-1",
      tables: [{ id: "MCP_Test" }]
    });
    assert.equal(calls, 1);
  } finally {
    await stop(server);
  }
});

test("query action forwards filters/default limit and rejects limits above 200", async () => {
  const observed: unknown[] = [];
  const { baseUrl, server } = await startApi(
    fakeGrist({
      queryRecords: async (documentId, tableId, options) => {
        observed.push({ documentId, tableId, options });
        return { records: [{ id: 1 }] };
      }
    })
  );

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/tables/MCP_Test/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ filter: { Statut: ["Initial"] } })
      }
    );
    assert.equal(response.status, 200);
    assert.deepEqual(observed, [
      {
        documentId: "doc-1",
        tableId: "MCP_Test",
        options: { filter: { Statut: ["Initial"] }, limit: 50 }
      }
    ]);

    const tooLarge = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/tables/MCP_Test/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ limit: 201 })
      }
    );
    assert.equal(tooLarge.status, 400);
    assert.equal(observed.length, 1);
  } finally {
    await stop(server);
  }
});
