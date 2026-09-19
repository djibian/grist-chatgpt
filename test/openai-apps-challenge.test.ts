import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";

import express from "express";

import {
  OPENAI_APPS_CHALLENGE_PATH,
  parseOpenAiAppsChallengeToken,
  registerOpenAiAppsChallenge
} from "../src/openaiAppsChallenge.js";

async function start(token: string | undefined): Promise<{
  baseUrl: string;
  server: Server;
}> {
  const app = express();
  registerOpenAiAppsChallenge(app, token);
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function stop(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("domain challenge is not registered when no portal token is configured", async () => {
  const { baseUrl, server } = await start(undefined);
  try {
    const response = await fetch(`${baseUrl}${OPENAI_APPS_CHALLENGE_PATH}`);
    assert.equal(response.status, 404);
  } finally {
    await stop(server);
  }
});

test("domain challenge returns only the exact configured token as plain text", async () => {
  const token = "openai-domain-verification-token-123";
  const { baseUrl, server } = await start(token);
  try {
    const response = await fetch(`${baseUrl}${OPENAI_APPS_CHALLENGE_PATH}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/plain\b/);
    assert.equal(await response.text(), token);
  } finally {
    await stop(server);
  }
});

test("challenge token parser preserves exact content and rejects whitespace ambiguity", () => {
  const token = "OpenAI_Exact.Token-42";
  assert.equal(parseOpenAiAppsChallengeToken(token), token);
  assert.equal(parseOpenAiAppsChallengeToken(undefined), undefined);
  assert.equal(parseOpenAiAppsChallengeToken(""), undefined);

  for (const invalid of [` ${token}`, `${token} `, `${token}\nextra`, `${token}\r\n`]) {
    assert.throws(
      () => parseOpenAiAppsChallengeToken(invalid),
      /exact portal token/
    );
  }
});
