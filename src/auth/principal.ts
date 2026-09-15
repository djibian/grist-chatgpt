export type PrincipalTransport = "gpt-actions" | "mcp";

export const GRIST_CAPABILITIES = [
  "doc:read",
  "doc:write",
  "doc.schema:write"
] as const;

export type GristCapability = (typeof GRIST_CAPABILITIES)[number];

export interface ResourceGrant {
  documentIds: readonly string[];
  workspaceIds: readonly string[];
  capabilities: readonly GristCapability[];
}

export interface Principal {
  id: string;
  transport: PrincipalTransport;
  grants: readonly ResourceGrant[];
}

export function createPrincipal(options: {
  id: string;
  transport: PrincipalTransport;
  documentIds: readonly string[];
  workspaceIds: readonly string[];
  capabilities: readonly GristCapability[];
}): Principal {
  return {
    id: options.id,
    transport: options.transport,
    grants: [
      {
        documentIds: [...options.documentIds],
        workspaceIds: [...options.workspaceIds],
        capabilities: [...options.capabilities]
      }
    ]
  };
}
