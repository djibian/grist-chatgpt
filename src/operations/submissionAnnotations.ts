import {
  OPERATION_REGISTRY,
  type OperationDefinition
} from "./registry.js";

export interface SubmissionAnnotationJustifications {
  readOnlyHint: string;
  destructiveHint: string;
  openWorldHint: string;
}

export interface SubmissionToolAnnotations {
  name: string;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    openWorldHint: boolean;
  };
  justifications: SubmissionAnnotationJustifications;
}

export interface SubmissionArtifactTool {
  annotations: SubmissionToolAnnotations["annotations"];
  justifications: {
    read_only_justification: string;
    open_world_justification: string;
    destructive_justification: string;
  };
}

export function buildSubmissionAnnotationJustifications(
  operation: OperationDefinition
): SubmissionAnnotationJustifications {
  const readOnlyHint = operation.auditOnly
    ? `${operation.title} retrieves Grist information and appends an audit event without changing Grist user data.`
    : operation.readOnly
    ? `${operation.title} only retrieves or computes Grist information and does not change Grist state.`
    : `${operation.title} changes Grist state, so it is not read-only.`;

  const destructiveHint = operation.auditOnly
    ? `${operation.title} only appends an audit event and does not overwrite or delete user data.`
    : operation.readOnly
    ? `${operation.title} performs no write and therefore cannot destructively change Grist state.`
    : operation.destructive
      ? `${operation.title} can overwrite, rename, clear, or delete existing Grist state, so the change may be destructive or require an explicit confirmation.`
      : `${operation.title} only adds new Grist state and does not overwrite or delete existing user state.`;

  const openWorldHint = operation.openWorld
    ? `${operation.title} can interact with external entities outside a pre-bounded private account or workspace.`
    : `${operation.title} is confined to the configured Grist deployment and the principal's bounded documents or workspaces; it does not access arbitrary public Internet entities.`;

  return {
    readOnlyHint,
    destructiveHint,
    openWorldHint
  };
}

export function buildSubmissionToolAnnotations(): SubmissionToolAnnotations[] {
  return OPERATION_REGISTRY.map((operation) => ({
    name: operation.name,
    annotations: {
      readOnlyHint: operation.readOnly,
      destructiveHint: operation.destructive,
      openWorldHint: operation.openWorld
    },
    justifications: buildSubmissionAnnotationJustifications(operation)
  }));
}

export function buildSubmissionArtifactTools(): Record<string, SubmissionArtifactTool> {
  return Object.fromEntries(
    buildSubmissionToolAnnotations().map((tool) => [
      tool.name,
      {
        annotations: tool.annotations,
        justifications: {
          read_only_justification: tool.justifications.readOnlyHint,
          open_world_justification: tool.justifications.openWorldHint,
          destructive_justification: tool.justifications.destructiveHint
        }
      }
    ])
  );
}
