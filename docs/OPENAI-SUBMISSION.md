# OpenAI distribution study

Status: exploratory. Requirements can change and must be re-checked against current OpenAI documentation before submission.

## Target experience

The desired user experience is a normal ChatGPT conversation in which an installed Grist integration can read and perform approved writes without using a Codex/Work session as the execution bridge.

## Current OpenAI model

OpenAI's Apps SDK is based on MCP. OpenAI accepts app submissions, and approved integrations may be distributed through the current plugin/app directory model.

Availability of a particular app or action depends on plan, region, workspace settings and supported surface. Directory visibility alone does not guarantee that every capability is available on every account.

## Development constraint

ChatGPT Developer Mode is the supported path for interactively testing custom MCP apps in ChatGPT. Current OpenAI documentation documents this workflow for Business and Enterprise/Edu workspaces.

This project owner currently targets a personal Plus workflow, so ChatGPT-specific pre-publication testing is a project risk. The MCP server can still be developed and tested independently with MCP tooling, but we must identify an eligible Developer Mode environment before claiming ChatGPT compatibility.

## Authentication constraint

The public application must not require users to expose a broad personal Grist API key to the model.

For Grist self-hosted deployments, upstream Grist provides OAuth connected apps and its native MCP server in the full edition. Community deployments retain REST API access but require a separate production authorization design.

## Provider / branding constraint

Before public submission, confirm with Grist Labs and, for the target French-government service, DINUM / La Suite numérique:

- permitted product name and marks;
- whether the integration may be represented as official, supported or community-maintained;
- preferred authentication architecture;
- whether upstream Grist MCP components can be reused or extended;
- support and incident ownership.

Until then this repository presents itself only as an independent prototype.

## Submission workstream

Before submission, prepare at minimum:

1. stable HTTPS MCP endpoint;
2. production authorization flow;
3. narrow and correctly annotated tool definitions;
4. privacy policy;
5. terms/support contact;
6. test environment containing synthetic data;
7. functional and adversarial test cases;
8. current OpenAI submission metadata and any domain-verification requirements;
9. provider authorization/branding position;
10. evidence that write actions are bounded, attributable and revocable.

## Go / no-go criterion

Proceed to public submission only when both are true:

- **technical:** a reviewer can safely authenticate and exercise read/write tools on synthetic Grist data;
- **institutional:** the integration's relationship to Grist/DINUM is explicit and not misleading.

## Official sources to re-check

- https://help.openai.com/en/articles/12515353-build-with-the-apps-sdk
- https://help.openai.com/en/articles/11487775
- https://help.openai.com/en/articles/12584461
- https://support.getgrist.com/oauth-apps/
- https://support.getgrist.com/mcp/
- https://support.getgrist.com/rest-api/
