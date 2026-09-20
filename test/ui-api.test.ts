import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";

import express from "express";

import {
  buildUiOpenApiPaths,
  buildUiOpenApiSchemas,
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

function noopUiOperations(overrides: Partial<GristUiOperations> = {}): GristUiOperations {
  return {
    createPage: async () => ({ page: { id: 7 } }),
    addPageWidget: async () => ({ widget: { id: 11 } }),
    renamePage: async () => ({ page: { id: 7 } }),
    updatePageLayout: async () => ({ page: { id: 7 } }),
    updatePageWidget: async () => ({ widget: { id: 11 } }),
    ...overrides
  };
}

test("UI OpenAPI exposes bounded consequential create and update actions", () => {
  const paths = buildUiOpenApiPaths() as any;
  const schemas = buildUiOpenApiSchemas() as any;

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
    paths["/api/v1/documents/{documentId}/pages/{pageId}"].patch.operationId,
    "renameGristPage"
  );
  assert.equal(
    paths["/api/v1/documents/{documentId}/pages/{pageId}/layout"].patch.operationId,
    "updateGristPageLayout"
  );
  assert.equal(
    paths["/api/v1/documents/{documentId}/pages/{pageId}/layout"].patch[
      "x-openai-isConsequential"
    ],
    true
  );
  assert.equal(
    paths["/api/v1/documents/{documentId}/pages/{pageId}/layout"].patch.requestBody
      .content["application/json"].schema.$ref,
    "#/components/schemas/PageLayoutUpdate"
  );
  assert.equal(schemas.PageLayoutUpdate.additionalProperties, false);
  assert.equal(schemas.PageLayoutNode.oneOf[0].additionalProperties, false);
  assert.equal(schemas.PageLayoutNode.oneOf[1].additionalProperties, false);
  assert.equal(
    schemas.PageLayoutNode.oneOf[1].properties.children.items.$ref,
    "#/components/schemas/PageLayoutNode"
  );
  assert.equal(
    paths["/api/v1/documents/{documentId}/pages/{pageId}/widgets"].post.operationId,
    "addGristPageWidget"
  );
  assert.equal(
    paths["/api/v1/documents/{documentId}/pages/{pageId}/widgets/{widgetId}"].patch.operationId,
    "updateGristPageWidget"
  );
  assert.equal(
    paths["/api/v1/documents/{documentId}/pages/{pageId}/widgets/{widgetId}"].patch[
      "x-openai-isConsequential"
    ],
    true
  );
  assert.deepEqual(
    paths["/api/v1/documents/{documentId}/pages/{pageId}/widgets"].post.requestBody
      .content["application/json"].schema.properties.type.enum,
    ["record", "single", "detail", "form", "chart", "calendar", "custom"]
  );
  assert.equal(
    paths["/api/v1/documents/{documentId}/pages/{pageId}/widgets"].post
      .requestBody.content["application/json"].schema.additionalProperties,
    false
  );
  assert.equal(
    paths["/api/v1/documents/{documentId}/pages/{pageId}/widgets/{widgetId}"].patch
      .requestBody.content["application/json"].schema.additionalProperties,
    false
  );
  assert.equal(
    paths["/api/v1/documents/{documentId}/pages/{pageId}/widgets/{widgetId}"].patch
      .requestBody.content["application/json"].schema.properties.description.type,
    "string"
  );
  assert.match(
    paths["/api/v1/documents/{documentId}/pages/{pageId}/widgets/{widgetId}"].patch
      .requestBody.content["application/json"].schema.properties.description.description,
    /clears the description/
  );

  const renameParameters = paths["/api/v1/documents/{documentId}/pages/{pageId}"].patch.parameters;
  assert.match(renameParameters[0].description, /Never invent/);
  assert.match(renameParameters[1].description, /getGristPages/);
  assert.ok(
    paths["/api/v1/documents/{documentId}/pages/{pageId}"].patch.responses["404"]
  );

  const updateParameters =
    paths["/api/v1/documents/{documentId}/pages/{pageId}/widgets/{widgetId}"].patch.parameters;
  assert.match(updateParameters[0].description, /Never invent/);
  assert.match(updateParameters[1].description, /getGristPages/);
  assert.match(updateParameters[2].description, /getGristPageWidgets/);
});

test("UI REST routes forward semantic page, layout and widget create/update requests", async () => {
  const observed: unknown[] = [];
  const grist = noopUiOperations({
    createPage: async (documentId, tableId, name) => {
      observed.push({ action: "page", documentId, tableId, name });
      return { documentId, page: { id: 7, name } };
    },
    addPageWidget: async (documentId, pageId, tableId, type) => {
      observed.push({ action: "widget", documentId, pageId, tableId, type });
      return { documentId, pageId, widget: { id: 11, tableId, type } };
    },
    renamePage: async (documentId, pageId, name) => {
      observed.push({ action: "rename-page", documentId, pageId, name });
      return { documentId, page: { id: pageId, name } };
    },
    updatePageLayout: async (documentId, pageId, layout) => {
      observed.push({ action: "update-layout", documentId, pageId, layout });
      return { documentId, page: { id: pageId } };
    },
    updatePageWidget: async (documentId, pageId, widgetId, update) => {
      observed.push({ action: "update-widget", documentId, pageId, widgetId, update });
      return { documentId, pageId, widget: { id: widgetId } };
    }
  });
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

    const renameResponse = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/pages/7`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Suivi personnes" })
      }
    );
    assert.equal(renameResponse.status, 200);

    const layout = {
      root: {
        kind: "group",
        children: [
          { kind: "widget", widgetId: 11 },
          { kind: "widget", widgetId: 12 }
        ]
      },
      collapsedWidgetIds: []
    };
    const layoutResponse = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/pages/7/layout`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layout)
      }
    );
    assert.equal(layoutResponse.status, 200);

    const updateResponse = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/pages/7/widgets/12`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Fiche personne",
          description: "Résumé affiché",
          selectBy: { sourceWidgetId: 11 }
        })
      }
    );
    assert.equal(updateResponse.status, 200);

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
      },
      {
        action: "rename-page",
        documentId: "doc-1",
        pageId: 7,
        name: "Suivi personnes"
      },
      {
        action: "update-layout",
        documentId: "doc-1",
        pageId: 7,
        layout
      },
      {
        action: "update-widget",
        documentId: "doc-1",
        pageId: 7,
        widgetId: 12,
        update: {
          title: "Fiche personne",
          description: "Résumé affiché",
          selectBy: { sourceWidgetId: 11 }
        }
      }
    ]);
  } finally {
    await stop(server);
  }
});

test("UI REST routes reject arbitrary widget types before calling Grist", async () => {
  let calls = 0;
  const grist = noopUiOperations({
    addPageWidget: async () => {
      calls += 1;
      return { widget: { id: 11 } };
    }
  });
  const { baseUrl, server } = await startApi(grist);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/pages/7/widgets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: "Personnes", type: "arbitrary" })
      }
    );
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  } finally {
    await stop(server);
  }
});

test("layout update rejects unknown fields before calling Grist", async () => {
  let calls = 0;
  const grist = noopUiOperations({
    updatePageLayout: async () => {
      calls += 1;
      return { page: { id: 7 } };
    }
  });
  const { baseUrl, server } = await startApi(grist);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/documents/doc-1/pages/7/layout`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          root: { kind: "widget", widgetId: 11, arbitrary: true }
        })
      }
    );
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  } finally {
    await stop(server);
  }
});

test("widget update rejects unknown fields and empty patches before calling Grist", async () => {
  let calls = 0;
  const grist = noopUiOperations({
    updatePageWidget: async () => {
      calls += 1;
      return { widget: { id: 11 } };
    }
  });
  const { baseUrl, server } = await startApi(grist);

  try {
    for (const body of [{}, { arbitrary: true }]) {
      const response = await fetch(
        `${baseUrl}/api/v1/documents/doc-1/pages/7/widgets/11`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      assert.equal(response.status, 400);
    }
    assert.equal(calls, 0);
  } finally {
    await stop(server);
  }
});
