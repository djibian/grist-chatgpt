import assert from "node:assert/strict";
import test from "node:test";

import {
  GristClient,
  type NewGristRecord,
  type UpdateGristRecord
} from "../src/grist/client.js";

type CapturedRequest = {
  url: string;
  init: RequestInit;
};

function mockFetch(
  responseBody: unknown,
  status = 200
): { requests: CapturedRequest[]; restore: () => void } {
  const original = globalThis.fetch;
  const requests: CapturedRequest[] = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: input instanceof Request ? input.url : String(input),
      init: init ?? {}
    });

    const body =
      responseBody === null ? null : JSON.stringify(responseBody);

    return new Response(body, {
      status,
      headers: body === null ? undefined : { "Content-Type": "application/json" }
    });
  }) as typeof fetch;

  return {
    requests,
    restore: () => {
      globalThis.fetch = original;
    }
  };
}

function client(): GristClient {
  return new GristClient({
    baseUrl: "https://grist.example.org",
    apiKey: "test-secret-never-sent"
  });
}

test("listTables builds the expected Grist REST URL", async () => {
  const mock = mockFetch({ tables: [] });
  try {
    await client().listTables("doc123");
    assert.equal(
      mock.requests[0]?.url,
      "https://grist.example.org/api/docs/doc123/tables"
    );
    assert.equal(
      new Headers(mock.requests[0]?.init.headers).get("Authorization"),
      "Bearer test-secret-never-sent"
    );
  } finally {
    mock.restore();
  }
});

test("listTables accepts a DINUM-style Grist document URL", async () => {
  const mock = mockFetch({ tables: [] });
  try {
    await client().listTables(
      "https://grist.example.org/o/docs/aGUygEv64sRs/Test-ChatGPT-MCP"
    );
    assert.equal(
      mock.requests[0]?.url,
      "https://grist.example.org/api/docs/aGUygEv64sRs/tables"
    );
  } finally {
    mock.restore();
  }
});

test("document URLs from another origin are rejected before fetch", async () => {
  const mock = mockFetch({ tables: [] });
  try {
    await assert.rejects(
      () =>
        client().listTables(
          "https://attacker.example/doc/aGUygEv64sRs/Test"
        ),
      /same origin/
    );
    assert.equal(mock.requests.length, 0);
  } finally {
    mock.restore();
  }
});

test("queryRecords forwards filter and limit", async () => {
  const mock = mockFetch({ records: [] });
  try {
    await client().queryRecords("doc123", "MCP_Test", {
      filter: { Statut: ["Initial"] },
      limit: 10
    });

    const url = new URL(mock.requests[0]!.url);
    assert.equal(url.pathname, "/api/docs/doc123/tables/MCP_Test/records");
    assert.equal(url.searchParams.get("limit"), "10");
    assert.deepEqual(
      JSON.parse(url.searchParams.get("filter") ?? "{}"),
      { Statut: ["Initial"] }
    );
  } finally {
    mock.restore();
  }
});

test("createRecords uses POST with Grist record payload", async () => {
  const mock = mockFetch({ records: [{ id: 3 }] });
  try {
    const records: NewGristRecord[] = [
      { fields: { Nom: "Gamma", Nombre: 3 } }
    ];
    await client().createRecords("doc123", "MCP_Test", records);

    assert.equal(mock.requests[0]?.init.method, "POST");
    assert.deepEqual(
      JSON.parse(String(mock.requests[0]?.init.body)),
      { records }
    );
  } finally {
    mock.restore();
  }
});

test("updateRecords accepts an empty successful Grist response", async () => {
  const mock = mockFetch(null, 200);
  try {
    const records: UpdateGristRecord[] = [
      { id: 3, fields: { Nombre: 30, Statut: "Modifié par MCP" } }
    ];

    const result = await client().updateRecords(
      "doc123",
      "MCP_Test",
      records
    );

    assert.equal(result, null);
    assert.equal(mock.requests[0]?.init.method, "PATCH");
    assert.deepEqual(
      JSON.parse(String(mock.requests[0]?.init.body)),
      { records }
    );
  } finally {
    mock.restore();
  }
});
