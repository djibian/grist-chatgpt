import { timingSafeEqual } from "node:crypto";

export function isAuthorizedBearerHeader(
  authorizationHeader: string | undefined,
  expectedToken: string
): boolean {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return false;
  }

  const actualToken = authorizationHeader.slice("Bearer ".length);
  const actual = Buffer.from(actualToken, "utf8");
  const expected = Buffer.from(expectedToken, "utf8");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
