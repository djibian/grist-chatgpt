import { buildSubmissionToolAnnotations } from "../src/operations/submissionAnnotations.js";

console.log(
  JSON.stringify(
    {
      generatedFrom: "src/operations/registry.ts",
      tools: buildSubmissionToolAnnotations()
    },
    null,
    2
  )
);
