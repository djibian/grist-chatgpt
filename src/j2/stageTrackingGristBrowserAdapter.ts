import { createHash } from "node:crypto";

import type { GristClient } from "../grist/client.js";
import {
  J2_STAGE_TRACKING_FIXTURE_STATES,
  type J2StageId,
  type J2TeacherId
} from "./stageTrackingFixture.js";
import type {
  J2BrowserMutationObservation,
  J2BrowserSessionKind,
  J2BrowserStageObservation,
  J2ControlledBrowserSession,
  J2ControlledBrowserSessionFactory,
  J2ObservedAccess,
  J2TraceMutation
} from "./stageTrackingBrowserVerifier.js";
import type { J2SyntheticLinkKeyVault } from "./stageTrackingSyntheticAccess.js";
import { J2ChromiumCdpPage } from "./chromiumCdpPipe.js";

const HARD_RECORD_LIMIT = 8;
const SELECTOR_PROFILE = "grist-core-b393db7" as const;
const FIXTURE_STATE = J2_STAGE_TRACKING_FIXTURE_STATES["date-present-human-modified"];
const INVALID_LINK_KEY = "j2-invalid-link-key-control-value";
const MUTATION_VALUES = Object.freeze({
  ENTER: "J2 trace saisie",
  CORRECT: "J2 trace corrigée",
  CONTACT_DATE: "2026-09-16"
});

export interface J2GristBrowserAdapterConfig {
  gristOrigin: string;
  documentId: string;
  documentPath: string;
  teacherPageRef: number;
  alternatePageRef: number;
  chromiumExecutable: string;
  gristVersion: string;
  selectorProfile: typeof SELECTOR_PROFILE;
}

export type J2GristBrowserOwnerClient = Pick<GristClient, "queryRecords" | "applyUserActions">;

interface MetadataRecord {
  id: number;
  fields: Record<string, unknown>;
}

interface FixtureSnapshot {
  stages: Record<J2StageId, MetadataRecord>;
  teachers: Record<J2TeacherId, MetadataRecord>;
}

interface UiObservation {
  loaded: boolean;
  stageVisible: boolean;
  traceFieldVisible: boolean;
  contactDateVisible: boolean;
  assignmentFieldVisible: boolean;
}

type Editability = "EDITABLE" | "READ_ONLY" | "NOT_FOUND" | "UNKNOWN";

function boundedOrigin(value: string): string {
  const parsed = new URL(value);
  const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (
    (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) ||
    parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash
  ) {
    throw new Error("J2 browser Grist origin must be an HTTPS origin or a local HTTP origin.");
  }
  return parsed.origin;
}

function boundedDocumentId(value: string): string {
  if (!/^[A-Za-z0-9_-]{8,96}$/.test(value)) {
    throw new Error("J2 browser fixture target must be one bounded Grist document ID.");
  }
  return value;
}

function boundedDocumentPath(value: string, documentId: string): string {
  if (!value.startsWith("/") || value.length > 512 || /[?#\r\n\0]/.test(value)) {
    throw new Error("J2 browser document path must be one bounded path without query or fragment.");
  }
  const segments = value.split("/").filter(Boolean);
  if (!segments.includes(documentId)) {
    throw new Error("J2 browser document path must contain the exact configured fixture document ID.");
  }
  if (segments.some((segment) => !/^[A-Za-z0-9._~-]+$/.test(segment))) {
    throw new Error("J2 browser document path contains an unsupported segment.");
  }
  return `/${segments.join("/")}`;
}

function boundedPageRef(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1_000_000_000) {
    throw new Error(`${label} must be one positive Grist page reference.`);
  }
  return value;
}

function boundedVersion(value: string): string {
  if (!/^[A-Za-z0-9._+:-]{1,64}$/.test(value)) {
    throw new Error("J2 browser Grist version must be one bounded opaque version marker.");
  }
  return value;
}

export function validateJ2GristBrowserAdapterConfig(
  input: J2GristBrowserAdapterConfig
): J2GristBrowserAdapterConfig {
  const documentId = boundedDocumentId(input.documentId);
  if (input.selectorProfile !== SELECTOR_PROFILE) {
    throw new Error("J2 browser selector profile is unsupported and must fail closed.");
  }
  return Object.freeze({
    gristOrigin: boundedOrigin(input.gristOrigin),
    documentId,
    documentPath: boundedDocumentPath(input.documentPath, documentId),
    teacherPageRef: boundedPageRef(input.teacherPageRef, "J2 teacher page"),
    alternatePageRef: boundedPageRef(input.alternatePageRef, "J2 alternate page"),
    chromiumExecutable: input.chromiumExecutable,
    gristVersion: boundedVersion(input.gristVersion),
    selectorProfile: SELECTOR_PROFILE
  });
}

function teacherHandle(teacherId: J2TeacherId): string {
  const teacher = FIXTURE_STATE.teachers.find((candidate) => candidate.id === teacherId);
  if (!teacher) throw new Error("J2 fixture teacher handle is missing.");
  return teacher.linkKeyHandle;
}

function stageLabel(stageId: J2StageId): string {
  const stage = FIXTURE_STATE.stages.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error("J2 fixture Stage label is missing.");
  return stage.studentLabel;
}

function recordsFromResponse(value: unknown, label: string): MetadataRecord[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} returned an unsupported response shape.`);
  }
  const records = (value as Record<string, unknown>).records;
  if (!Array.isArray(records) || records.length > HARD_RECORD_LIMIT) {
    throw new Error(`${label} exceeded the bounded fixture record shape.`);
  }
  return records.map((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error(`${label} contained an invalid record.`);
    }
    const record = candidate as Record<string, unknown>;
    if (!Number.isSafeInteger(record.id) || (record.id as number) <= 0) {
      throw new Error(`${label} contained an invalid record ID.`);
    }
    if (!record.fields || typeof record.fields !== "object" || Array.isArray(record.fields)) {
      throw new Error(`${label} contained invalid fields.`);
    }
    return { id: record.id as number, fields: record.fields as Record<string, unknown> };
  });
}

function indexFixtureRecords<T extends J2StageId | J2TeacherId>(
  records: MetadataRecord[],
  expected: readonly T[],
  label: string
): Record<T, MetadataRecord> {
  const map = new Map<T, MetadataRecord>();
  for (const record of records) {
    const fixtureId = record.fields.Fixture_Id;
    if (typeof fixtureId !== "string" || !expected.includes(fixtureId as T)) continue;
    if (map.has(fixtureId as T)) throw new Error(`${label} contains duplicate fixture identities.`);
    map.set(fixtureId as T, record);
  }
  if (map.size !== expected.length) throw new Error(`${label} fixture identities are incomplete.`);
  return Object.fromEntries(map) as Record<T, MetadataRecord>;
}

async function readSnapshot(
  client: J2GristBrowserOwnerClient,
  documentId: string
): Promise<FixtureSnapshot> {
  const [stagesRaw, teachersRaw] = await Promise.all([
    client.queryRecords(documentId, "Stages", { limit: HARD_RECORD_LIMIT }),
    client.queryRecords(documentId, "Enseignants", { limit: HARD_RECORD_LIMIT })
  ]);
  return {
    stages: indexFixtureRecords(
      recordsFromResponse(stagesRaw, "J2 owner Stage read"),
      ["stage-a", "stage-b"] as const,
      "J2 Stage"
    ),
    teachers: indexFixtureRecords(
      recordsFromResponse(teachersRaw, "J2 owner teacher read"),
      ["teacher-a", "teacher-b"] as const,
      "J2 teacher"
    )
  };
}

function logicalTeacher(snapshot: FixtureSnapshot, stageId: J2StageId): J2TeacherId | null {
  const ref = snapshot.stages[stageId].fields.Suivi_par;
  if (ref === snapshot.teachers["teacher-a"].id) return "teacher-a";
  if (ref === snapshot.teachers["teacher-b"].id) return "teacher-b";
  return null;
}

function sameProtectedStage(before: FixtureSnapshot, after: FixtureSnapshot, stageId: J2StageId): boolean {
  const beforeFields = before.stages[stageId].fields;
  const afterFields = after.stages[stageId].fields;
  return JSON.stringify(beforeFields) === JSON.stringify(afterFields);
}

function normalizeForFingerprint(snapshot: FixtureSnapshot): unknown {
  return {
    stages: (["stage-a", "stage-b"] as const).map((id) => ({ id, fields: snapshot.stages[id].fields })),
    teachers: (["teacher-a", "teacher-b"] as const).map((id) => ({
      id,
      rowId: snapshot.teachers[id].id,
      active: snapshot.teachers[id].fields.Acces_Stages_Actif === true,
      hasLinkKey: typeof snapshot.teachers[id].fields.Token_Stages === "string" &&
        (snapshot.teachers[id].fields.Token_Stages as string).length > 0
    }))
  };
}

function normScript(): string {
  return `const norm=(v)=>String(v??"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/_/g," ").toLowerCase().replace(/\\s+/g," ").trim();`;
}

function inspectExpression(studentLabel: string): string {
  const student = JSON.stringify(studentLabel);
  return `(()=>{${normScript()}
    const body=document.body?.innerText??"";
    const loaded=Boolean(document.querySelector(".active_section,.test-raw-data-list,.test-treeview-container,.viewsection_content"));
    const stageVisible=body.includes(${student});
    const labels=[...document.querySelectorAll(".g_record_detail_label,.g-column-label")].map((el)=>norm(el.textContent));
    const has=(wanted)=>labels.includes(norm(wanted));
    return {loaded,stageVisible,traceFieldVisible:has("Commentaire"),contactDateVisible:has("Date du contact"),assignmentFieldVisible:has("Suivi par")};
  })()`;
}

function editFieldExpression(studentLabel: string, fieldLabel: string): string {
  return `(()=>{${normScript()}
    const wantedStudent=${JSON.stringify(studentLabel)};
    const wantedField=norm(${JSON.stringify(fieldLabel)});
    const card=[...document.querySelectorAll(".g_record_detail_el")].find((el)=>norm(el.querySelector(".g_record_detail_label")?.textContent)===wantedField);
    let target=card?.querySelector(".g_record_detail_value .field_clip,.g_record_detail_value")??null;
    if(!target){
      const section=document.querySelector(".active_section");
      if(section){
        const headers=[...section.querySelectorAll(".g-column-label")];
        const col=headers.findIndex((el)=>norm(el.textContent)===wantedField);
        const row=[...section.querySelectorAll(".gridview_row")].find((el)=>el.textContent?.includes(wantedStudent));
        if(col>=0&&row){target=row.querySelectorAll(".field_clip")[col]??null;}
      }
    }
    if(!target)return "NOT_FOUND";
    target.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,detail:1}));
    target.dispatchEvent(new MouseEvent("mouseup",{bubbles:true,detail:1}));
    target.dispatchEvent(new MouseEvent("click",{bubbles:true,detail:1}));
    target.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,detail:2}));
    return "CLICKED";
  })()`;
}

const EDITABILITY_EXPRESSION = `(()=>{
  const active=document.activeElement;
  const editor=document.querySelector(".celleditor_cursor_editor,.test-text-editor,input.autocomplete-text-input,textarea");
  if(!editor&&!active)return "READ_ONLY";
  const candidate=editor??active;
  if(candidate instanceof HTMLInputElement||candidate instanceof HTMLTextAreaElement||candidate?.getAttribute?.("contenteditable")==="true")return "EDITABLE";
  return "READ_ONLY";
})()`;

const SELECT_ACTIVE_EDITOR_EXPRESSION = `(()=>{
  const active=document.activeElement;
  if(active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement){active.select();return true;}
  if(active?.getAttribute?.("contenteditable")==="true"){document.execCommand("selectAll",false);return true;}
  const editor=document.querySelector(".celleditor_cursor_editor input,.celleditor_cursor_editor textarea");
  if(editor instanceof HTMLInputElement||editor instanceof HTMLTextAreaElement){editor.focus();editor.select();return true;}
  return false;
})()`;

function rawDataExpression(studentLabel: string): string {
  return `(()=>{
    const raw=document.querySelector(".test-tools-raw");
    if(!raw)return "NO_CONTROL";
    raw.click();
    return ${JSON.stringify(studentLabel)};
  })()`;
}

function openRawStagesExpression(): string {
  return `(()=>{${normScript()}
    const list=document.querySelector(".test-raw-data-list");
    if(!list)return "NOT_READY";
    const tables=[...list.querySelectorAll(".test-raw-data-table-title")];
    const stages=tables.find((el)=>norm(el.textContent)==="stages");
    if(!stages)return "DENIED";
    stages.click();
    return "OPENING";
  })()`;
}

async function waitFor<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 4_000): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (accept(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return undefined;
}

export class J2StageTrackingGristBrowserFactory implements J2ControlledBrowserSessionFactory {
  readonly config: J2GristBrowserAdapterConfig;

  constructor(
    config: J2GristBrowserAdapterConfig,
    private readonly ownerClient: J2GristBrowserOwnerClient,
    private readonly vault: J2SyntheticLinkKeyVault
  ) {
    this.config = validateJ2GristBrowserAdapterConfig(config);
  }

  async assertProvisionedFixture(): Promise<void> {
    const [snapshot, teacherAKey, teacherBKey] = await Promise.all([
      readSnapshot(this.ownerClient, this.config.documentId),
      this.vault.getOrCreate(teacherHandle("teacher-a")),
      this.vault.getOrCreate(teacherHandle("teacher-b"))
    ]);
    if (
      snapshot.teachers["teacher-a"].fields.Token_Stages !== teacherAKey ||
      snapshot.teachers["teacher-b"].fields.Token_Stages !== teacherBKey ||
      snapshot.teachers["teacher-a"].fields.Acces_Stages_Actif !== true ||
      snapshot.teachers["teacher-b"].fields.Acces_Stages_Actif !== true
    ) {
      throw new Error("J2 browser fixture is not in the exact provisioned synthetic access state.");
    }
  }

  async fixtureRevision(): Promise<string> {
    const snapshot = await readSnapshot(this.ownerClient, this.config.documentId);
    return createHash("sha256").update(JSON.stringify(normalizeForFingerprint(snapshot))).digest("hex");
  }

  async open(kind: J2BrowserSessionKind): Promise<J2ControlledBrowserSession> {
    const key = await this.keyFor(kind);
    const page = await J2ChromiumCdpPage.launch(this.config.chromiumExecutable);
    try {
      const session = new J2StageTrackingGristBrowserSession(
        kind,
        this.config,
        this.ownerClient,
        page,
        key
      );
      await session.openTeacherPage();
      return session;
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  async revokeTeacherALinkKey(): Promise<"APPLIED" | "UNKNOWN"> {
    const secret = await this.vault.getOrCreate(teacherHandle("teacher-a"));
    const before = await readSnapshot(this.ownerClient, this.config.documentId);
    const teacher = before.teachers["teacher-a"];
    if (teacher.fields.Token_Stages !== secret) return "UNKNOWN";

    try {
      await this.ownerClient.applyUserActions(this.config.documentId, [
        ["UpdateRecord", "Enseignants", teacher.id, { Token_Stages: "" }]
      ]);
    } catch {
      // The effect may have reached Grist. Do not replay it; inspect exactly once below.
    }

    try {
      const after = await readSnapshot(this.ownerClient, this.config.documentId);
      return after.teachers["teacher-a"].fields.Token_Stages === "" ? "APPLIED" : "UNKNOWN";
    } catch {
      return "UNKNOWN";
    }
  }

  private async keyFor(kind: J2BrowserSessionKind): Promise<string | null> {
    if (kind === "missing-key") return null;
    if (kind === "invalid-key") return INVALID_LINK_KEY;
    const teacherId: J2TeacherId = kind === "teacher-b" ? "teacher-b" : "teacher-a";
    return this.vault.getOrCreate(teacherHandle(teacherId));
  }
}

class J2StageTrackingGristBrowserSession implements J2ControlledBrowserSession {
  constructor(
    private readonly kind: J2BrowserSessionKind,
    private readonly config: J2GristBrowserAdapterConfig,
    private readonly ownerClient: J2GristBrowserOwnerClient,
    private readonly page: J2ChromiumCdpPage,
    private readonly linkKey: string | null
  ) {}

  async openTeacherPage(): Promise<void> {
    await this.navigate(this.config.teacherPageRef);
    const observation = await waitFor(
      () => this.inspect("stage-a"),
      (value) => value.loaded
    );
    if (!observation?.loaded) throw new Error("J2 teacher browser page did not reach the supported Grist UI profile.");
  }

  async observeStage(stageId: J2StageId): Promise<J2BrowserStageObservation> {
    const [ui, snapshot] = await Promise.all([
      this.inspect(stageId),
      readSnapshot(this.ownerClient, this.config.documentId)
    ]);
    const protectedRead = this.readDecision(ui);
    return {
      protectedRead,
      stageIdentity: protectedRead === "ALLOW" ? stageId : null,
      currentAssignment: protectedRead === "ALLOW" ? logicalTeacher(snapshot, stageId) : null,
      contactDateReachable: protectedRead === "ALLOW" ? ui.contactDateVisible : null
    };
  }

  async writeTrace(stageId: J2StageId, mutation: J2TraceMutation): Promise<J2BrowserMutationObservation> {
    const before = await readSnapshot(this.ownerClient, this.config.documentId);
    const ui = await this.inspect(stageId);
    if (!ui.loaded) return { access: "UNKNOWN", application: "UNKNOWN" };
    if (!ui.stageVisible) {
      const after = await readSnapshot(this.ownerClient, this.config.documentId);
      return {
        access: "DENY",
        application: sameProtectedStage(before, after, stageId) ? "NOT_APPLIED" : "UNKNOWN"
      };
    }

    const field = mutation === "CONTACT_DATE" ? "Date du contact" : "Commentaire";
    const editability = await this.beginEdit(stageId, field);
    if (editability === "READ_ONLY" || editability === "NOT_FOUND") {
      const after = await readSnapshot(this.ownerClient, this.config.documentId);
      return {
        access: this.kind === "teacher-a" ? "UNKNOWN" : "DENY",
        application: sameProtectedStage(before, after, stageId) ? "NOT_APPLIED" : "UNKNOWN"
      };
    }
    if (editability !== "EDITABLE") return { access: "UNKNOWN", application: "UNKNOWN" };

    const selected = await this.page.evaluate<boolean>(SELECT_ACTIVE_EDITOR_EXPRESSION);
    if (!selected) return { access: "UNKNOWN", application: "UNKNOWN" };
    if (mutation === "CLEAR") {
      await this.page.sendKey("DELETE");
    } else {
      await this.page.insertText(MUTATION_VALUES[mutation]);
    }
    await this.page.sendKey("ENTER");

    const desired = await waitFor(
      () => readSnapshot(this.ownerClient, this.config.documentId),
      (snapshot) => this.mutationApplied(snapshot, stageId, mutation),
      3_000
    );
    if (desired) return { access: "ALLOW", application: "APPLIED" };

    const after = await readSnapshot(this.ownerClient, this.config.documentId);
    return {
      access: sameProtectedStage(before, after, stageId) ? "UNKNOWN" : "ALLOW",
      application: sameProtectedStage(before, after, stageId) ? "NOT_APPLIED" : "UNKNOWN"
    };
  }

  async attemptAssignmentChange(
    stageId: J2StageId,
    teacherId: J2TeacherId
  ): Promise<J2BrowserMutationObservation> {
    const before = await readSnapshot(this.ownerClient, this.config.documentId);
    const ui = await this.inspect(stageId);
    if (!ui.loaded) return { access: "UNKNOWN", application: "UNKNOWN" };
    if (!ui.stageVisible || !ui.assignmentFieldVisible) {
      const after = await readSnapshot(this.ownerClient, this.config.documentId);
      return {
        access: "DENY",
        application: sameProtectedStage(before, after, stageId) ? "NOT_APPLIED" : "UNKNOWN"
      };
    }

    const editability = await this.beginEdit(stageId, "Suivi par");
    if (editability === "READ_ONLY" || editability === "NOT_FOUND") {
      const after = await readSnapshot(this.ownerClient, this.config.documentId);
      return {
        access: "DENY",
        application: sameProtectedStage(before, after, stageId) ? "NOT_APPLIED" : "UNKNOWN"
      };
    }
    if (editability !== "EDITABLE") return { access: "UNKNOWN", application: "UNKNOWN" };

    const targetName = FIXTURE_STATE.teachers.find((candidate) => candidate.id === teacherId)?.displayName;
    if (!targetName) return { access: "UNKNOWN", application: "UNKNOWN" };
    const selected = await this.page.evaluate<boolean>(SELECT_ACTIVE_EDITOR_EXPRESSION);
    if (!selected) return { access: "UNKNOWN", application: "UNKNOWN" };
    await this.page.insertText(targetName);
    await this.page.sendKey("ENTER");

    const changed = await waitFor(
      () => readSnapshot(this.ownerClient, this.config.documentId),
      (snapshot) => logicalTeacher(snapshot, stageId) === teacherId,
      2_000
    );
    if (changed) return { access: "ALLOW", application: "APPLIED" };

    const after = await readSnapshot(this.ownerClient, this.config.documentId);
    return {
      access: "UNKNOWN",
      application: sameProtectedStage(before, after, stageId) ? "NOT_APPLIED" : "UNKNOWN"
    };
  }

  async observeRawData(stageId: J2StageId): Promise<J2ObservedAccess> {
    await this.navigate(this.config.teacherPageRef);
    const control = await this.page.evaluate<string>(rawDataExpression(stageLabel(stageId)));
    if (control === "NO_CONTROL") return "UNKNOWN";
    const listReady = await waitFor(
      () => this.page.evaluate<boolean>("Boolean(document.querySelector('.test-raw-data-list'))"),
      Boolean
    );
    if (!listReady) return "UNKNOWN";

    const opening = await this.page.evaluate<string>(openRawStagesExpression());
    if (opening === "DENIED") return "DENY";
    if (opening !== "OPENING") return "UNKNOWN";
    const overlay = await waitFor(
      () => this.page.evaluate<boolean>("Boolean(document.querySelector('.test-raw-data-overlay'))"),
      Boolean
    );
    if (!overlay) return "UNKNOWN";
    const visible = await this.page.evaluate<boolean>(
      `document.body?.innerText?.includes(${JSON.stringify(stageLabel(stageId))})===true`
    );
    return visible ? "ALLOW" : "DENY";
  }

  async observeAlternateView(stageId: J2StageId): Promise<J2ObservedAccess> {
    await this.navigate(this.config.alternatePageRef);
    const observation = await waitFor(
      () => this.inspect(stageId),
      (value) => value.loaded
    );
    if (!observation?.loaded) return "UNKNOWN";
    return this.readDecision(observation);
  }

  async close(): Promise<void> {
    await this.page.close();
  }

  private async navigate(pageRef: number): Promise<void> {
    const url = new URL(this.config.documentPath, this.config.gristOrigin);
    url.searchParams.set("p", String(pageRef));
    if (this.linkKey !== null) url.searchParams.set("Token_", this.linkKey);
    await this.page.navigate(url.toString());
  }

  private async inspect(stageId: J2StageId): Promise<UiObservation> {
    const value = await this.page.evaluate<UiObservation>(inspectExpression(stageLabel(stageId)));
    if (!value || typeof value !== "object") {
      return { loaded: false, stageVisible: false, traceFieldVisible: false, contactDateVisible: false, assignmentFieldVisible: false };
    }
    return value;
  }

  private readDecision(ui: UiObservation): J2ObservedAccess {
    if (!ui.loaded) return "UNKNOWN";
    if (!ui.stageVisible) return "DENY";
    return ui.traceFieldVisible ? "ALLOW" : "UNKNOWN";
  }

  private async beginEdit(stageId: J2StageId, fieldLabel: string): Promise<Editability> {
    const clicked = await this.page.evaluate<string>(editFieldExpression(stageLabel(stageId), fieldLabel));
    if (clicked === "NOT_FOUND") return "NOT_FOUND";
    if (clicked !== "CLICKED") return "UNKNOWN";
    await new Promise((resolve) => setTimeout(resolve, 150));
    const value = await this.page.evaluate<string>(EDITABILITY_EXPRESSION);
    return value === "EDITABLE" || value === "READ_ONLY" ? value : "UNKNOWN";
  }

  private mutationApplied(snapshot: FixtureSnapshot, stageId: J2StageId, mutation: J2TraceMutation): boolean {
    const fields = snapshot.stages[stageId].fields;
    if (mutation === "ENTER") return fields.Commentaire === MUTATION_VALUES.ENTER;
    if (mutation === "CORRECT") return fields.Commentaire === MUTATION_VALUES.CORRECT;
    if (mutation === "CLEAR") return fields.Commentaire === "" || fields.Commentaire === null;
    const expectedSeconds = Math.floor(Date.parse(`${MUTATION_VALUES.CONTACT_DATE}T00:00:00Z`) / 1000);
    return fields.Date_du_contact === expectedSeconds || fields.Date_du_contact === MUTATION_VALUES.CONTACT_DATE;
  }
}
