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
const MAX_READ = 1000;
const MAX_WRITE = 100;

function fakeGrist(overrides: Partial<GristOperations> = {}): GristOperations {
  return {
    listDocuments: async () => ({ documents: [] }),
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
  registerGptActionApi(app, {
    token: TOKEN,
    grist,
    maxReadRecords: MAX_READ,
    maxWriteRecords: MAX_WRITE
  });

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

test("OpenAPI exposes discovery and configurable guardrails", () => {
  const document = buildOpenApiDocument("https://bridge.example.org", {
    maxReadRecords: MAX_READ,
    maxWriteRecords: MAX_WRITE
  }) as any;

  assert.equal(document.servers[0].url, "https://bridge.example.org");
  assert.equal(
    document.paths["/api/v1/documents"].get.operationId,
    "listGristDocuments"
  );
  assert.equal(
    document.paths["/api/v1/documents/{documentId}/tables/{tableId}/query"].post
      .requestBody.content["application/json"].schema.properties.limit.maximum,
    MAX_READ
  );
  assert.equal(
    document.paths["/api/v1/documents/{documentId}/tables/{tableId}/records"].post
      .requestBody.content["application/json"].schema.properties.records.maxItems,
    MAX_WRITE
  );
  assert.equal(
    document.paths["/api/v1/documents/{documentId}/tables/{tableId}/query"].post[
      "x-openai-isConsequential"
    ],
    false
  );
});

test("REST API rejects missing bearer token and lists allowed documents", async () => {
  let calls = 0;
  const { baseUrl, server } = await startApi(
    fakeGrist({
      listDocuments: async () => {
        calls += 1;
        return { documents: [{ document: { id: "doc-1" } }] };
      }
    })
  );

  try {
    const unauthorized = await fetch(`${baseUrl}/api/v1/documents`);
    assert.equal(unauthorized.status, 401);
    assert.equal(calls, 0);

    const authorized = await fetch(`${baseUrl}/api/v1/documents`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    assert.equal(authorized.status, 200);
    assert.deepEqual(await authorized.json(), {
      documents: [{ document: { id: "doc-1" } }]
    });
    assert.equal(calls, 1);
  } finally {
    await stop(server);
  }
});

test("query action forwards sort and format options and enforces configured limit", async () => {
  const observed: unknown[] = [];
  const { baseUrl, server } = await startApi(
    fakeGrist({
      queryRecords: async (documentId, tableId, options) => {
        observed.push({ documentId, tableId, options });
        return { records: [{ id: 1 }] };
      }
    })
  );

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json"
  };

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/tables/MCP_Test/query`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          filter: { Statut: ["Initial"] },
          sort: "Nom,-Nombre",
          limit: 999,
          hidden: true,
          cellFormat: "typed"
        })
      }
    );
    assert.equal(response.status, 200);
    assert.deepEqual(observed, [
      {
        documentId: "doc-1",
        tableId: "MCP_Test",
        options: {
          filter: { Statut: ["Initial"] },
          sort: "Nom,-Nombre",
          limit: 999,
          hidden: true,
          cellFormat: "typed"
        }
      }
    ]);

    const tooLarge = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/tables/MCP_Test/query`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ limit: 1001 })
      }
    );
    assert.equal(tooLarge.status, 400);
    assert.equal(observed.length, 1);
  } finally {
    await stop(server);
  }
});

test("create action uses configurable write guardrail", async () => {
  let calls = 0;
  const { baseUrl, server } = await startApi(
    fakeGrist({
      createRecords: async () => {
        calls += 1;
        return { records: [] };
      }
    })
  );

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json"
  };

  try {
    const accepted = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/tables/MCP_Test/records`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ records: [{ fields: { Nom: "Delta" } }] })
      }
    );
    assert.equal(accepted.status, 200);
    assert.equal(calls, 1);

    const tooMany = Array.from({ length: MAX_WRITE + 1 }, (_, index) => ({
      fields: { Index: index }
    }));
    const rejected = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/tables/MCP_Test/records`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ records: tooMany })
      }
    );
    assert.equal(rejected.status, 400);
    assert.equal(calls, 1);
  } finally {
    await stop(server);
  }
});
