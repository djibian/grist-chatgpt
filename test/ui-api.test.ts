import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";

import express from "express";

import {
  buildUiOpenApiPaths,
  registerUiActionApi,
  type GristUiOperations
} from "../src/actions/uiApi.js";

async function startApi(
  grist: GristUiOperations
): Promise<{ baseUrl: string; server: Server }> {
  const app = express();
  app.use(express.json());
  registerUiActionApi(app, {
    grist,
    sendError: (res, error) => {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
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

test("UI OpenAPI exposes only bounded consequential creation actions", () => {
  const paths = buildUiOpenApiPaths() as any;

  assert.equal(
    paths["/api/v1/documents/{documentId}/pages"].post.operationId,
    "createGristPage"
  );
  assert.equal(
    paths["/api/v1/documents/{documentId}/pages"].post[
      "x-openai-isConsequential"
    ],
    true
  );
  assert.equal(
    paths["/api/v1/documents/{documentId}/pages/{pageId}/widgets"].post.operationId,
    "addGristPageWidget"
  );
  assert.deepEqual(
    paths["/api/v1/documents/{documentId}/pages/{pageId}/widgets"].post.requestBody
      .content["application/json"].schema.properties.type.enum,
    ["record", "single", "detail", "form", "chart", "calendar", "custom"]
  );
});

test("UI REST routes forward semantic page and widget requests", async () => {
  const observed: unknown[] = [];
  const grist: GristUiOperations = {
    createPage: async (documentId, tableId, name) => {
      observed.push({ action: "page", documentId, tableId, name });
      return { documentId, page: { id: 7, name } };
    },
    addPageWidget: async (documentId, pageId, tableId, type) => {
      observed.push({ action: "widget", documentId, pageId, tableId, type });
      return { documentId, pageId, widget: { id: 11, tableId, type } };
    }
  };
  const { baseUrl, server } = await startApi(grist);

  try {
    const pageResponse = await fetch(`${baseUrl}/api/v1/documents/doc-1/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: "Personnes", name: "Vue générale" })
    });
    assert.equal(pageResponse.status, 200);

    const widgetResponse = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/pages/7/widgets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: "Personnes", type: "record" })
      }
    );
    assert.equal(widgetResponse.status, 200);

    assert.deepEqual(observed, [
      {
        action: "page",
        documentId: "doc-1",
        tableId: "Personnes",
        name: "Vue générale"
      },
      {
        action: "widget",
        documentId: "doc-1",
        pageId: 7,
        tableId: "Personnes",
        type: "record"
      }
    ]);
  } finally {
    await stop(server);
  }
});
