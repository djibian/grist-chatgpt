import type { McpHandlerRequestOptions, McpHttpHandler } from "@modelcontextprotocol/server";

import { buildInsufficientScopeToolChallenge } from "../auth/oauthProtectedResource.js";
import type { GristCapability, Principal } from "../auth/principal.js";
import { getOperation } from "../operations/registry.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requestedToolName(options: McpHandlerRequestOptions | undefined): string | undefined {
  const body = options?.parsedBody;
  if (!isRecord(body) || body.method !== "tools/call" || !isRecord(body.params)) {
    return undefined;
  }
  return typeof body.params.name === "string" ? body.params.name : undefined;
}

function requiredCapability(toolName: string): GristCapability | undefined {
  try {
    return getOperation(toolName).capability ?? undefined;
  } catch {
    return undefined;
  }
}

function principalHasCapability(
  principal: Principal,
  capability: GristCapability
): boolean {
  return principal.grants.some((grant) => grant.capabilities.includes(capability));
}

function addChallengeToErrorResult(
  value: unknown,
  challenge: string
): { value: unknown; changed: boolean } {
  if (!isRecord(value) || !isRecord(value.result) || value.result.isError !== true) {
    return { value, changed: false };
  }

  const meta = isRecord(value.result._meta) ? value.result._meta : {};
  return {
    changed: true,
    value: {
      ...value,
      result: {
        ...value.result,
        _meta: {
          ...meta,
          "mcp/www_authenticate": [challenge]
        }
      }
    }
  };
}

export function installOAuthToolAuthChallenges(
  handler: McpHttpHandler,
  options: {
    principal: Principal;
    resourceMetadataUrl: string;
  }
): McpHttpHandler {
  const originalFetch = handler.fetch;

  handler.fetch = async (request, requestOptions) => {
    const toolName = requestedToolName(requestOptions);
    const capability = toolName ? requiredCapability(toolName) : undefined;
    const missingCapability =
      capability !== undefined &&
      !principalHasCapability(options.principal, capability);

    const response = await originalFetch(request, requestOptions);
    if (!missingCapability || !capability) return response;

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json")) return response;

    let body: unknown;
    try {
      body = await response.clone().json();
    } catch {
      return response;
    }

    const challenge = buildInsufficientScopeToolChallenge(
      options.resourceMetadataUrl,
      capability
    );
    const transformed = addChallengeToErrorResult(body, challenge);
    if (!transformed.changed) return response;

    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(JSON.stringify(transformed.value), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };

  return handler;
}
