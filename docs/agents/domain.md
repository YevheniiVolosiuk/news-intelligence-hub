# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo is **single-context**: one `CONTEXT.md` and one `docs/adr/` at the root. The frontend, backend, and `.docker` directories are a deployment split, not separate bounded contexts — they share one ubiquitous language defined in `CONTEXT.md`.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the project's glossary (User, Feed, Source, Article, Labelling, Importance, Category, Axis, Entity, Mention, Duplicate, Similar Article, Graph, Co-mention, Regeneration, Pre-Filter, Digest, Telemetry, and more).
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT.md
├── docs/adr/
│   └── 0001-shared-article-per-user-labelling.md
├── backend/
├── frontend/
└── .docker/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly lists under `_Avoid_`.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (shared raw Articles, per-User Labelling) — but worth reopening because…_
