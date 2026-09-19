# C5 credential lifecycle: human decision package

Status: awaiting human decision; no storage or encryption design is selected.

This package records the minimum decisions required by `AGENTS.md` and C5 in
`ROADMAP.md`. C4 productionization can continue independently. The existing
static Grist credential path must not be used to onboard a second real user.

## Decision to record

The deployment owner must name or explicitly approve:

1. **Persistence:** the authorized store for per-principal encrypted Grist
   credentials, its operator, backup location and retention/deletion policy.
   State whether an existing operator-managed service must be reused or a
   separate bridge-owned store may be introduced; do not assume the Logto
   database is authorized for application credentials.
2. **Encryption and key custody:** the approved key-management service or
   operating model, who may access keys, and how key rotation and recovery
   are handled. Approve the design before implementation; never put actual
   keys or secret material in the decision record.
3. **Ownership:** who operates the bridge, performs incident response and
   authorizes credential retention for the intended deployment. Do not infer
   DINUM sponsorship, hosting responsibility or institutional commitments.

If these choices require a technical proposal, the owner may instead authorize
preparation of options against concrete hosting, backup and key-custody
constraints. Such a proposal is not approval to implement or deploy a design.

## Fixed acceptance boundary

- Every credential is associated with an authenticated bridge principal and
  a verified upstream Grist identity for the one configured Grist instance.
- Credentials are entered only through a secure bridge-owned web flow, never
  through MCP tools, prompts, logs, audit payloads or committed files.
- Stored credential material is encrypted at rest; access is principal-bound
  and missing, disconnected or invalid credentials fail closed.
- Disconnect removes the active association and credential; the approved
  backup policy must explain retention and recovery behavior after deletion.
- Rotation/revalidation and two-principal isolation require explicit tests.
- Grist remains the ACL authority; no new public scope or shared technical
  upstream account is introduced.

## Resumption

Record the non-secret decision in a reviewed PR linked from `CREDENTIALS.md`
and `ROADMAP.md`. Re-evaluate C4 completion and the approved design before
starting C5 implementation. S0 remains a separate public-distribution gate.
