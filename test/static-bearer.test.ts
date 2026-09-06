import assert from "node:assert/strict";
import test from "node:test";

import { isAuthorizedBearerHeader } from "../src/auth/staticBearer.js";

const TOKEN = "0123456789abcdef0123456789abcdef";

test("accepts the exact bearer token", () => {
  assert.equal(
    isAuthorizedBearerHeader(`Bearer ${TOKEN}`, TOKEN),
    true
  );
});

test("rejects missing, malformed and incorrect bearer tokens", () => {
  assert.equal(isAuthorizedBearerHeader(undefined, TOKEN), false);
  assert.equal(isAuthorizedBearerHeader(TOKEN, TOKEN), false);
  assert.equal(
    isAuthorizedBearerHeader("Bearer wrong-token", TOKEN),
    false
  );
});
