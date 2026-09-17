# ProConnect / MCP compatibility probe status

The repository-side compatibility tranche is complete on this branch.

## Established result

Current public ProConnect implementation evidence is sufficient to answer the architectural compatibility question without requiring a registered integration client merely to reproduce the same failure:

- PKCE S256 is implemented and covered by ProConnect tests;
- the discovery surface includes `code_challenge_methods_supported`;
- the OIDC provider configuration explicitly sets `resourceIndicators: { enabled: false }`;
- MCP 2026-07-28 requires OAuth Resource Indicators (RFC 8707) for the target MCP resource.

Therefore **ProConnect cannot currently be used directly as the MCP authorization server while remaining conformant with MCP 2026-07-28**.

This conclusion concerns ProConnect's role as the MCP-facing authorization server only. ProConnect remains a valid candidate as the upstream institutional identity source in a federated architecture.

## What remains useful

The executable probe and live A/B procedure remain in the repository for future revalidation if:

- ProConnect enables RFC 8707 Resource Indicators;
- a deployed ProConnect environment is shown to differ from the assessed public configuration;
- the project later needs end-to-end evidence for a changed provider release.

No client secret, authorization code, OAuth token or session credential is required or stored for the current compatibility conclusion.

## C4 consequence

The human gate is narrowed: architecture A (direct ProConnect as MCP authorization server) is not viable in the current configuration. The next human decision concerns the intermediary authorization-server architecture/provider while preserving ProConnect as the preferred identity source unless a separate decision changes that.
