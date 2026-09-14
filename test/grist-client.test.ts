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

    const body = responseBody === null ? null : JSON.stringify(responseBody);
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

test("lists orgs and workspaces for discovery", async () => {
  const mock = mockFetch([]);
  try {
    await client().listOrgs();
    await client().listWorkspaces(42);
    assert.equal(mock.requests[0]?.url, "https://grist.example.org/api/orgs");
    assert.equal(
      mock.requests[1]?.url,
      "https://grist.example.org/api/orgs/42/workspaces"
    );
  } finally {
    mock.restore();
  }
});

test("listTables builds the expected Grist REST URL", async () => {
  const mock = mockFetch({ tables: [] });
  try {
    await client().listTables("doc123", { expandColumns: true });
    assert.equal(
      mock.requests[0]?.url,
      "https://grist.example.org/api/docs/doc123/tables?expand=column"
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
      () => client().listTables("https://attacker.example/doc/aGUygEv64sRs/Test"),
      /same origin/
    );
    assert.equal(mock.requests.length, 0);
  } finally {
    mock.restore();
  }
});

test("queryRecords forwards filter, sort, limit and format options", async () => {
  const mock = mockFetch({ records: [] });
  try {
    await client().queryRecords("doc123", "MCP_Test", {
      filter: { Statut: ["Initial"] },
      sort: "Nom,-Nombre",
      limit: 1000,
      hidden: true,
      cellFormat: "typed"
    });

    const url = new URL(mock.requests[0]!.url);
    assert.equal(url.pathname, "/api/docs/doc123/tables/MCP_Test/records");
    assert.equal(url.searchParams.get("limit"), "1000");
    assert.equal(url.searchParams.get("sort"), "Nom,-Nombre");
    assert.equal(url.searchParams.get("hidden"), "true");
    assert.equal(url.searchParams.get("cellFormat"), "typed");
    assert.deepEqual(JSON.parse(url.searchParams.get("filter") ?? "{}"), {
      Statut: ["Initial"]
    });
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
    assert.deepEqual(JSON.parse(String(mock.requests[0]?.init.body)), { records });
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
    const result = await client().updateRecords("doc123", "MCP_Test", records);

    assert.equal(result, null);
    assert.equal(mock.requests[0]?.init.method, "PATCH");
    assert.deepEqual(JSON.parse(String(mock.requests[0]?.init.body)), { records });
  } finally {
    mock.restore();
  }
});

test("deleteRecords uses Grist records/delete with a raw ID array", async () => {
  const mock = mockFetch(null, 200);
  try {
    await client().deleteRecords("doc123", "MCP_Test", [4, 7]);
    assert.equal(
      mock.requests[0]?.url,
      "https://grist.example.org/api/docs/doc123/tables/MCP_Test/records/delete"
    );
    assert.equal(mock.requests[0]?.init.method, "POST");
    assert.deepEqual(JSON.parse(String(mock.requests[0]?.init.body)), [4, 7]);
  } finally {
    mock.restore();
  }
});

test("table schema methods use the official tables endpoint", async () => {
  const mock = mockFetch({ tables: [] });
  try {
    await client().createTables("doc123", [
      { id: "People", columns: [{ id: "Name", fields: { type: "Text" } }] }
    ]);
    await client().updateTables("doc123", [
      { id: "People", fields: { tableId: "Persons" } }
    ]);

    assert.equal(mock.requests[0]?.init.method, "POST");
    assert.equal(mock.requests[1]?.init.method, "PATCH");
    assert.equal(
      mock.requests[0]?.url,
      "https://grist.example.org/api/docs/doc123/tables"
    );
    assert.equal(mock.requests[1]?.url, mock.requests[0]?.url);
  } finally {
    mock.restore();
  }
});

test("column schema methods use the expected Grist REST contracts", async () => {
  const mock = mockFetch({ columns: [] });
  try {
    await client().listColumns("doc123", "People", { hidden: true });
    await client().createColumns("doc123", "People", [
      { id: "Age", fields: { type: "Int" } }
    ]);
    await client().updateColumns("doc123", "People", [
      { id: "Age", fields: { label: "Âge" } }
    ]);
    await client().deleteColumn("doc123", "People", "Age");

    const base = "https://grist.example.org/api/docs/doc123/tables/People/columns";
    assert.equal(mock.requests[0]?.url, `${base}?hidden=true`);
    assert.equal(mock.requests[1]?.url, base);
    assert.equal(mock.requests[1]?.init.method, "POST");
    assert.equal(mock.requests[2]?.url, base);
    assert.equal(mock.requests[2]?.init.method, "PATCH");
    assert.equal(mock.requests[3]?.url, `${base}/Age`);
    assert.equal(mock.requests[3]?.init.method, "DELETE");
  } finally {
    mock.restore();
  }
});

test("applyUserActions posts only the action array supplied by the service", async () => {
  const mock = mockFetch({ actionNum: 1 });
  try {
    const actions = [["RenameColumn", "People", "Name", "FullName"]];
    await client().applyUserActions("doc123", actions);
    assert.equal(
      mock.requests[0]?.url,
      "https://grist.example.org/api/docs/doc123/apply"
    );
    assert.equal(mock.requests[0]?.init.method, "POST");
    assert.deepEqual(JSON.parse(String(mock.requests[0]?.init.body)), actions);
  } finally {
    mock.restore();
  }
});
