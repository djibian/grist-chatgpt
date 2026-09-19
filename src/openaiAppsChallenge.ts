import type { Express } from "express";

export const OPENAI_APPS_CHALLENGE_PATH =
  "/.well-known/openai-apps-challenge" as const;

export function parseOpenAiAppsChallengeToken(
  raw: string | undefined
): string | undefined {
  if (raw === undefined || raw === "") return undefined;

  if (raw.trim() !== raw || /[\r\n]/.test(raw)) {
    throw new Error(
      "OPENAI_APPS_CHALLENGE_TOKEN must contain the exact portal token without surrounding whitespace or line breaks."
    );
  }

  return raw;
}

export function registerOpenAiAppsChallenge(
  app: Express,
  token: string | undefined
): void {
  if (token === undefined) return;

  app.get(OPENAI_APPS_CHALLENGE_PATH, (_req, res) => {
    res.status(200).type("text/plain").end(token);
  });
}
