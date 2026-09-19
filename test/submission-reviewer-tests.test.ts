import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type SubmissionCase = {
  description?: unknown;
  user_prompt?: unknown;
  tools_triggered?: unknown;
  expected_output?: unknown;
  file_attachment_urls?: unknown;
  expected_output_url?: unknown;
};

async function loadSubmission(): Promise<{
  test_cases: SubmissionCase[];
  negative_test_cases: SubmissionCase[];
}> {
  const raw = await readFile(
    new URL("../chatgpt-app-submission.json", import.meta.url),
    "utf8"
  );
  return JSON.parse(raw) as {
    test_cases: SubmissionCase[];
    negative_test_cases: SubmissionCase[];
  };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const positiveDescriptions = [
  "Inspect a synthetic reviewer document without unnecessary row disclosure.",
  "Filter and limit synthetic records, including a no-match query.",
  "Create bounded records and verify independently.",
  "Create and update a bounded synthetic schema.",
  "Create a page and configure a safe direct select-by link."
];

const negativeDescriptions = [
  "Do not invoke for unrelated calendar access.",
  "Do not invoke for arbitrary HTTP forwarding.",
  "Do not invoke for Grist account or ACL administration."
];

test("tracked submission contains exactly the canonical five positive reviewer cases", async () => {
  const artifact = await loadSubmission();
  assert.equal(artifact.test_cases.length, 5);
  assert.deepEqual(
    artifact.test_cases.map((entry) => entry.description),
    positiveDescriptions
  );

  for (const entry of artifact.test_cases) {
    assert.ok(nonEmptyString(entry.user_prompt));
    assert.ok(nonEmptyString(entry.tools_triggered));
    assert.ok(nonEmptyString(entry.expected_output));
    assert.equal(entry.file_attachment_urls, null);
    assert.equal(entry.expected_output_url, null);
  }
});

test("tracked submission contains exactly the canonical three safe non-invocation cases", async () => {
  const artifact = await loadSubmission();
  assert.equal(artifact.negative_test_cases.length, 3);
  assert.deepEqual(
    artifact.negative_test_cases.map((entry) => entry.description),
    negativeDescriptions
  );

  for (const entry of artifact.negative_test_cases) {
    assert.ok(nonEmptyString(entry.user_prompt));
    assert.ok(nonEmptyString(entry.expected_output));
    assert.equal(entry.tools_triggered, null);
    assert.equal(entry.file_attachment_urls, null);
    assert.equal(entry.expected_output_url, null);
  }
});

test("reviewer test prompts remain synthetic and credential-free", async () => {
  const artifact = await loadSubmission();
  const serialized = JSON.stringify([
    ...artifact.test_cases,
    ...artifact.negative_test_cases
  ]);

  assert.match(serialized, /synthetic|reviewer document/i);
  assert.doesNotMatch(serialized, /Bearer\s+[A-Za-z0-9._-]+/i);
  assert.doesNotMatch(serialized, /(?:api[_-]?key|password)\s*[:=]\s*[^,}\s]+/i);
});
