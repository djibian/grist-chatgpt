# Product vision

## Mission

`grist-chatgpt` is an **agentic Grist application builder and lifecycle maintainer**.

It lets a user express a business need while the product understands the relevant Grist application, designs a desired state, plans bounded changes, executes them under an enforceable contract, verifies the resulting behavior, and maintains the application over time.

The durable differentiator is not raw Grist API coverage or the number of MCP tools. It is the ability to **transform and maintain a Grist application through explicit contracts, bounded effects, recoverable execution, preservation of legitimate human changes, and contextualized evidence**.

The existing bounded Grist operations remain valuable. They become the execution primitives underneath a higher-level builder rather than being replaced by a generic remote-control surface.

## Product boundary

```text
Primary public contract : MCP
Compatibility surface   : GPT Actions / OpenAPI
Initial Grist target     : Grist Community, DINUM / La Suite numérique
Initial tenancy model    : multi-user, one configured Grist instance
Code source of truth     : GitHub when generated/custom code is involved
Data/native config truth : Grist
```

The product is not intended to compete with Grist's official MCP on raw API breadth where the official integration is available and sufficient. Its value is the governed design, transformation, verification and lifecycle layer above Grist capabilities.

## Three distinct responsibilities

```text
User / agent
    |
    v
BUILDER
  understand the need
  propose business contracts
  design desired state
  produce plans
    |
    v
EXECUTION ENGINE
  enforce authority and mandates
  enforce budgets and preconditions
  journal before effects
  execute and classify effects
  detect or refuse unsafe concurrency
  recover or suspend
  produce contextualized evidence
    |
    v
CONNECTORS / ADAPTERS
  Grist REST + bounded internal actions
  GitHub
  controlled browser verification
  explicitly authorized integrations
```

The Builder proposes. The execution engine authorizes, refuses or suspends. Connectors perform effects.

No mutation path may bypass the execution engine once the corresponding capability has entered the contractual Builder surface. This applies equally to MCP, GPT Actions compatibility calls, durable jobs, browser-mediated actions and integrations.

## Application contract

A Grist application is broader than its tables.

```text
ApplicationContract
├── ApplicationModel
│   ├── DataModel
│   ├── UIModel
│   ├── LogicModel
│   ├── AccessModel
│   ├── IntegrationModel
│   └── MaintenanceModel
├── BehavioralContract
├── ImpactGraph
└── ManagedScope
```

### ApplicationModel

The model covers, as applicable:

- tables, columns, types, relations, formulas and business data;
- pages, views, forms, widgets, filters, select-by behavior and layouts;
- business logic and invariants;
- application-level access rules, including LinkKey-dependent policies when used;
- custom widgets, GitHub artifacts, webhooks and explicitly authorized integrations;
- versions, dependencies, migrations, workarounds and known exceptions.

A structural change is complete only when affected layers remain coherent. For example, adding a table to an application whose confidentiality depends on LinkKey rules must also preserve the corresponding access policy.

### BehavioralContract

Correctness is defined by business behavior, not only by schema shape.

Examples for a stage-tracking application include:

- an assigned teacher can record the visits for which they are responsible;
- creating a new period does not create duplicate stages;
- reassigning a stage preserves existing observations unless an accepted rule says otherwise;
- a new table that participates in the protected domain preserves the expected teacher isolation;
- repeating an already satisfied build intent creates no duplicates.

Business criteria and accepted examples/counter-examples are versioned independently from their implementation. The Builder may propose them, but may not weaken accepted criteria merely to make a plan pass.

### ManagedScope

Management mode and knowledge state are separate dimensions.

Management mode:

```text
MANAGED  — the Builder is responsible for maintaining the accepted property
SHARED   — humans and Builder may both change it; reconciliation is required
OBSERVED — the Builder may inspect it but preserves human authority over it
```

Knowledge state may independently be `KNOWN`, `PARTIAL` or `UNKNOWN`.

A property may therefore be `OBSERVED + UNKNOWN` or `MANAGED + PARTIAL`.

Each managed/shared property also records an authority/owner and a conflict policy. Even a human change to a `MANAGED` property is not silently overwritten.

### Logical identity

The Builder distinguishes logical identity, current Grist identifier and human label. A column rename is not automatically modeled as delete-plus-create when continuity can be established safely.

Mappings required for migrations, copies and deployments are durable application metadata.

## Observation and reconciliation

`DocumentState` is always an observed state, never an assertion of omniscience.

Observation evidence records at least:

- exact target document;
- relevant revision/version marker when observable;
- principal/identity and permissions used;
- observation time;
- inspected scope;
- inaccessible or incomplete areas;
- evidence needed by later verification.

The product never equates "not observed" with "absent".

Convergence is a reconciliation problem:

```text
PreviouslyAcceptedState
        +
CurrentObservedState
        +
DesiredState
        ->
ReconciliationPlan
```

Differences may be expected business evolution, legitimate human changes, requested changes, real drift, conflict or unknown state. Convergence means satisfying the accepted properties in the managed scope while preserving legitimate changes outside it.

Business rows are not configuration to be reset to an earlier snapshot. A migration modifies business data only when that migration is explicitly part of the accepted plan.

## Impact graph and evidence invalidation

The Builder progressively maintains a dependency graph across schema, formulas, access rules, pages, widgets, mappings, code, integrations, tests and evidence.

Each dependency is classified as `CONFIRMED`, `POSSIBLE` or `UNKNOWN`.

The graph serves two purposes:

1. explain the known and possible impact of a proposed change;
2. invalidate evidence whose dependencies have changed.

A browser test proving LinkKey isolation on a particular document revision and Grist version is useful evidence for those scenarios. It is not a timeless global proof. A relevant ACL, formula, widget, dependency or Grist-version change can make that evidence stale and require re-verification.

Unknown areas unrelated to the current change do not automatically block the whole application. They block only guarantees whose dependency graph reaches them.

## Contract authority

Accepted contracts have identifiable authority and immutable versions.

The Builder may not unilaterally:

- downgrade a `CRITICAL` property to a lower criticality;
- remove or weaken a mandatory test because it fails;
- change acceptance criteria after a plan is accepted;
- exclude an inconvenient known dependency merely to declare success;
- extend a mandate or budget.

Such changes require the identified human authority or a previously granted delegation that explicitly permits them.

## ExecutionContract

Every real transformation is linked to an immutable execution contract containing, as applicable:

```text
contract version
application and exact target
principal / acting identity
mandate version
plan version
preconditions
allowed effects
cumulative budgets
conflict policy
recovery strategy
BehavioralContract version
required checks
critical properties
```

The Builder produces plans; the engine enforces the contract independently of model wording.

### Effect-oriented mandates

Mandates constrain effects, not merely tool names.

For example, a mandate may allow adding columns and updating pages while prohibiting without fresh approval:

- deleting a table;
- broadening data exposure;
- increasing a custom widget from limited access to `full` access;
- introducing a new network destination;
- publishing data or an application publicly.

A formula or widget-setting change may therefore count as an access/confidentiality effect even though no operation is named "change ACL".

### Cumulative budgets

Limits may apply per operation, plan, application, principal and time window. They may bound records, bytes, duration, external calls, concurrent jobs, mutations and other measurable effects. A large job may not evade a plan budget by splitting itself into many individually small calls.

Mandates are revocable. Long-running work re-checks authorization before the next meaningful effect rather than assuming authorization remains valid forever.

## Durable execution semantics

Execution state is multidimensional.

Execution lifecycle examples:

```text
PENDING | RUNNING | SUSPENDED | COMPLETED
```

Effect knowledge examples:

```text
NOT_APPLIED | PARTIALLY_APPLIED | APPLIED | UNCERTAIN | COMPENSATED
```

Verification examples:

```text
VERIFIED | VIOLATED | UNKNOWN | NOT_APPLICABLE
```

A job may therefore be `SUSPENDED + PARTIALLY_APPLIED + UNKNOWN`.

### Journal before effect

For effectful steps, durable intent is recorded before issuing the upstream call. If the process stops after Grist applies an effect but before the result is durably recorded, the step resumes as `UNCERTAIN`, never as presumed `NOT_APPLIED`.

Confirmed partial results retain the identifiers and evidence needed for recovery. They are not collapsed to counters that lose the identity of already-applied work.

### Idempotence

Capabilities explicitly declare whether replay is `IDEMPOTENT`, `CONDITIONALLY_IDEMPOTENT`, `NON_IDEMPOTENT` or `UNKNOWN`. Presence of apparently similar data is not by itself proof that an uncertain create operation may be replayed safely.

When safe automatic recovery cannot be established, suspension with evidence is a correct outcome.

## Safety throughout a transformation

Critical invariants apply to intermediate states as well as final delivery.

The engine must not knowingly create an intermediate state that violates a critical confidentiality or integrity invariant merely because a later step is expected to repair it.

Depending on the actual Grist capability, safe execution may require an isolated copy/fork, protected preparation, an effectively atomic operation, a maintenance window or refusal to execute.

Irreversible external effects such as disclosure, webhook delivery or public publication must be prevented before they occur; they cannot be made safe by promising a later rollback.

## Concurrency

Post-write re-reading is useful verification but is not sufficient protection against overwriting a concurrent human change.

For each mutation capable of overwriting state, the supported execution mode must have an effective and tested protection such as a conditional write/revision guard, compare-and-set semantics or real isolation. If the available Grist primitives cannot provide adequate protection, that mutation is refused in that mode and the Builder may propose a genuinely isolated alternative such as a copy/fork or coordinated maintenance window.

`BEST_EFFORT` is descriptive, not permission to perform a known unsafe overwrite.

## Recovery

Sensitive transformations define their recovery strategy before execution. Depending on the capability this may be idempotent retry, targeted compensation, fork/snapshot use, controlled rollback, manual reconciliation or a maintenance window.

A full-document backup is not a universal rollback because restoring it may erase later legitimate human work. Some effects are not reversible at all.

## Guarantees and evidence

A verification verdict is always scoped to a property and context. Evidence records at least the property, verdict, tested state/revision, Grist version when relevant, tested identities, method, time and dependencies.

Verdicts are:

```text
VERIFIED | VIOLATED | UNKNOWN | NOT_APPLICABLE
```

Property criticality is independently:

```text
CRITICAL | IMPORTANT | INFORMATIONAL
```

The Builder may not lower criticality on its own.

A `CRITICAL + UNKNOWN` property blocks the change or service transition that depends on that property. It does not automatically block unrelated areas of the application.

## Access model and LinkKey

Application-level access behavior is part of the managed application when it is necessary for the application's confidentiality or function.

If a change adds a table, relation, formula, page or widget that may alter the access model, the impact is analyzed and the relevant access guarantees are re-verified.

When LinkKey behavior depends on the web client and cannot be demonstrated by owner-authenticated REST calls, browser scenarios are required before the corresponding isolation property may be marked `VERIFIED`.

Typical critical scenarios may include separate teacher links, invalid and revoked keys, new-table isolation and attempts to change relationships in ways that could broaden access.

## Privacy, secrets and untrusted content

The model receives the minimum data reasonably necessary for the task. Prefer schema and metadata, then aggregates or synthetic examples, then minimized samples; complete business rows are used only when required.

Credentials, bearer/OAuth tokens, API keys, encryption keys, LinkKeys and secret webhook material are never model-visible and are not stored in audit records.

Audit targets are normalized. A URL containing a link key or other secret is never logged verbatim merely because validation failed before it was normalized.

Cells, attachments, imports, custom-widget content, GitHub issues/comments and external responses are untrusted data. They may inform reasoning but cannot extend mandates, lower criticality, disable tests or change authorized destinations.

## Capability support levels

Every Builder capability is explicitly classified:

```text
SUPPORTED | EXPERIMENTAL | UNAVAILABLE | UNKNOWN
```

A supported capability documents its supported Grist versions/environments, preconditions, required permissions, known effects, verification method, concurrency protection, recovery semantics and known limitations.

Private Grist metadata or bounded internal UserActions may be used behind versioned tested adapters where necessary; they are not exposed as generic model-controlled escape hatches.

## Product evolution

### V1 — Native Grist Builder

Build and evolve applications primarily with native Grist capabilities under the execution contract. Scope grows only through capabilities that have explicit support contracts and evidence.

Target domains include schema, data migrations, imports, relations, formulas, pages, native widgets, forms/layouts, access policy, LinkKey-dependent behavior, behavioral contracts and impact analysis.

### V2 — Code and integrations

Add custom-widget and integration development when native Grist is not the best maintainable solution.

GitHub remains the source of truth for code. A deployed widget is identified by provenance, exact version/commit, artifact identity/hash, hosting target, Grist permissions, network destinations, document contract, supported Grist versions and verification suite. A mutable URL alone is not a sufficient production identity.

Deployment is progressive with compensation, not described as transactionally atomic when it is not. Prefer candidate build -> test -> versioned publication -> compatible Grist preparation -> switch -> verify -> retirement of the old version.

### V3 — Lifecycle Agent

Add durable maintenance over time: scheduled/event-triggered jobs, dependency and version monitoring, drift detection, evidence invalidation/re-verification, KnownException review, integration/widget maintenance and bounded upstream contribution workflows.

Conversation memory is never the persistence mechanism for lifecycle work.

## Known exceptions and upstream maintenance

A workaround is recorded when introduced, with evidence, affected versions, impact, workaround version, responsible party, last verification, next review trigger, upstream references and removal criteria.

When a Grist defect blocks a required behavior, the product may reproduce and diagnose it, search or create an upstream issue, develop regression tests and a patch, prepare/follow a pull request, track release availability, verify the deployed version and remove the workaround when safe.

The application must not silently depend on an upstream contribution being accepted. Until the upstream problem is effectively resolved, the affected function uses a validated workaround, an explicitly documented degraded mode, or remains suspended.

## Adoption and portability

An existing document is observed before it is placed under management:

```text
DISCOVER -> OBSERVE -> PROPOSE MANAGED SCOPE -> ACCEPT -> MANAGE
```

The Builder does not automatically claim ownership over everything it discovers.

Behavioral contracts, managed-scope declarations, logical-ID mappings, migration records, dependency manifests, known exceptions and verification evidence must be exportable. Data and native configuration remain usable in Grist and code remains usable in GitHub if the Builder is removed.

## Identity and production prerequisites

Builder work does not replace the existing production identity/security program.

### C4 — production OAuth MCP identity

The proven ProConnect -> Logto OSS -> MCP principal design remains the production identity direction until an explicit later product decision changes it.

### C5 — per-user Grist credentials

Every real production user executes upstream Grist work with that user's own Grist credential. The existing shared `StaticApiKeyCredentialProvider` path remains a development/prototype substitution and must not be treated as real multi-user isolation.

Credential persistence, encryption/key custody and production ownership remain explicit human decisions before C5 implementation.

### C6 — production hardening

Rate limiting, operational metrics/alerting, audit handling, secret rotation, controlled release/rollback evidence and authenticated synthetic smoke evidence remain required according to the authoritative roadmap.

J0/J1 work may be developed in an isolated controlled environment. Opening the Builder to multiple real users depends on the relevant C4/C5/C6 guarantees being complete.

## Sources of truth

```text
Grist
  business data + native configuration + current operational state

GitHub
  custom code + tests + version history

Builder durable state
  contracts + managed scope + accepted state + plans + evidence
  execution journal + known exceptions + jobs

AI conversation
  interaction surface, never durable project/application state
```

## Permanent boundaries

The product does not expose to the model:

- a generic HTTP proxy;
- raw SQL as an unrestricted general surface;
- arbitrary Grist `/apply` or UserAction payloads;
- model-visible credentials/secrets;
- universal Grist-instance administration;
- arbitrary multi-instance routing in the initial product.

Application-level access rules may be managed when they are part of the application's contract. That does not turn the Builder into a generic organization/user/SCIM administrator.

## Guiding invariant

> The Grist Builder agentically turns business intent into explicit, versioned and verifiable application properties. The Builder designs and proposes; an unavoidable execution engine independently enforces mandates, budgets, authorization, concurrency rules, intermediate-state safety and recovery; adapters perform the authorized effects. Critical criteria and their tests cannot be weakened by the Builder to make a plan pass. Evidence is contextualized and invalidated when its dependencies change. Real uncertainty remains uncertainty and causes further verification or suspension rather than invented certainty.
