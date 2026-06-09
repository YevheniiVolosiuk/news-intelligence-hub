# News Intelligence Hub

## Project map

- Roadmap / current slice: `docs/ROADMAP.md`
- Domain language: `CONTEXT.md`
- Architectural decisions: `docs/adr/`
- Source of truth (local only, not committed): `SPECIFICATION.md`

## Engineering constraints

Hold for every slice:

- Google TS Style Guide; linter green; no dead code; no non-printable Unicode (zero-width, BOM, directional marks).
- Structured logs with identifiers + outcome on every worker operation (NFR-2). Never swallow errors.
- All config via env; update `.env.example` with every new variable; no secrets in the repo.
- No LLM calls from HTTP handlers — always through the queue (Principle 3).
- The LLM is a precision tool: use it only for semantic work; do everything deterministic (parsing, hashing, dedup by URL/hash, pre-filter, graph assembly) in plain code (Principle 1).
- Tenancy enforced at the data layer, not just the UI (Principle 4); reject other Users' resources requested by direct ID. See ADR-0001.
- Meaningful commits showing progression (NFR-6) — never one big dump.

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, each mapped 1:1 to its default label string. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
