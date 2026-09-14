import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";

import express from "express";

import {
  buildOpenApiDocument,
  registerGptActionApi,
  type GristOperations
} from "../src/actions/api.js";
import { PartialBatchError } from "../src/grist/service.js";
import { VERSION } from "../src/version.js";

const TOKEN = "abcdef0123456789abcdef0123456789";
const MAX_READ = 1000;
const MAX_WRITE = 100;
const MAX_SCHEMA = 20;

function fakeGrist(overrides: Partial<GristOperations> = {}): GristOperations {
  return {
    listDocuments: async () => ({ documents: [] }),
    listTables: async () => ({ tables: [{ id: "Table1" }] }),
    queryRecords: async () => ({ records: [] }),
    createRecords: async () => ({ records: [{ id: 1 }] }),
    updateRecords: async () => null,
    deleteRecords: async () => null,
    listColumns: async () => ({ columns: [] }),
    createTables: async () => ({ tables: [] }),
    updateTables: async () => null,
    deleteTable: async () => null,
    createColumns: async () => ({ columns: [] }),
    updateColumns: async () => null,
    renameColumn: async () => null,
    deleteColumns: async () => null,
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
    maxWriteRecords: MAX_WRITE,
    maxSchemaItems: MAX_SCHEMA
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

test("OpenAPI exposes the runtime version and consequential schema management actions", () => {
  const document = buildOpenApiDocument("https://bridge.example.org", {
    maxReadRecords: MAX_READ,
    maxWriteRecords: MAX_WRITE,
    maxSchemaItems: MAX_SCHEMA
  }) as any;

  assert.equal(document.info.version, VERSION);
  assert.equal(document.servers[0].url, "https://bridge.example.org");
  assert.equal(
    document.paths["/api/v1/documents"].get.operationId,
    "listGristDocuments"
  );
  assert.equal(
    document.paths["/api/v1/documents/{documentId}/tables/{tableId}/records/delete"].post[
      "x-openai-isConsequential"
    ],
    true
  );
  assert.equal(
    document.paths["/api/v1/documents/{documentId}/tables/{tableId}/columns"].get.operationId,
    "listGristColumns"
  );
  assert.equal(
    document.paths["/api/v1/documents/{documentId}/schema/tables/delete"].post[
      "x-openai-isConsequential"
    ],
    true
  );
  assert.equal(
    document.paths["/api/v1/documents/{documentId}/tables/{tableId}/columns/create"].post
      .requestBody.content["application/json"].schema.properties.columns.maxItems,
    MAX_SCHEMA
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
    assert.equal(calls, 1);
  } finally {
    await stop(server);
  }
});

test("query action enforces configured read limit", async () => {
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
    const accepted = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/tables/MCP_Test/query`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ limit: 999 })
      }
    );
    assert.equal(accepted.status, 200);
    assert.equal(observed.length, 1);

    const rejected = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/tables/MCP_Test/query`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ limit: 1001 })
      }
    );
    assert.equal(rejected.status, 400);
  } finally {
    await stop(server);
  }
});

test("partial batched write is returned as an explicit non-retryable REST error", async () => {
  const { baseUrl, server } = await startApi(
    fakeGrist({
      createRecords: async () => {
        throw new PartialBatchError("createRecords", 2, 400, 3, new Error("boom"));
      }
    })
  );
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json"
  };

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/tables/MCP_Test/records`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ records: [{ fields: { Nom: "Delta" } }] })
      }
    );
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: "Partial Grist operation",
      operation: "createRecords",
      completedBatches: 2,
      completedItems: 400,
      failedBatch: 3,
      retryWholeOperation: false
    });
  } finally {
    await stop(server);
  }
});

test("delete record action forwards exact unique IDs", async () => {
  const observed: unknown[] = [];
  const { baseUrl, server } = await startApi(
    fakeGrist({
      deleteRecords: async (documentId, tableId, recordIds) => {
        observed.push({ documentId, tableId, recordIds });
        return null;
      }
    })
  );
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json"
  };

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/tables/MCP_Test/records/delete`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ recordIds: [4, 5] })
      }
    );
    assert.equal(response.status, 200);
    assert.deepEqual(observed, [
      { documentId: "doc-1", tableId: "MCP_Test", recordIds: [4, 5] }
    ]);
  } finally {
    await stop(server);
  }
});

test("schema routes forward formula metadata and targeted rename", async () => {
  const observed: unknown[] = [];
  const { baseUrl, server } = await startApi(
    fakeGrist({
      createColumns: async (documentId, tableId, columns) => {
        observed.push({ action: "create", documentId, tableId, columns });
        return { columns: [] };
      },
      renameColumn: async (documentId, tableId, oldColumnId, newColumnId) => {
        observed.push({
          action: "rename",
          documentId,
          tableId,
          oldColumnId,
          newColumnId
        });
        return null;
      }
    })
  );
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json"
  };

  try {
    const create = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/tables/People/columns/create`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          columns: [
            {
              id: "DoubleScore",
              fields: {
                type: "Int",
                isFormula: true,
                formula: "$Score * 2",
                widgetOptions: "{}"
              }
            }
          ]
        })
      }
    );
    assert.equal(create.status, 200);

    const rename = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/tables/People/columns/rename`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          oldColumnId: "DoubleScore",
          newColumnId: "ScoreX2"
        })
      }
    );
    assert.equal(rename.status, 200);
    assert.equal(observed.length, 2);
  } finally {
    await stop(server);
  }
});
