<!--
  DRAFT SCAFFOLD - NOT FINISHED, NOT YET OWNED.
  Rewrite every section below in your own words before submission. Section 9.6 grades
  the ADRs against the real implementation, and 9.7 penalises unedited generation.
  Delete this comment once you have rewritten and own the content.
-->

# News Intelligence Hub

Aggregates technical and industry news from user-supplied RSS/Atom feeds and turns the
stream into a per-User graph of articles, entities, and their relationships. An LLM is
used only for the semantic work (entity extraction, summary, importance, category and
axis assignment); everything deterministic (parsing, dedup by URL/hash, the pre-filter,
graph assembly) is plain code.

See [CONTEXT.md](./CONTEXT.md) for the project's ubiquitous language.

## Stack choices

- **Backend: NestJS** — full control over the LLM pipeline, workers, and graph logic.
- **Frontend: Next.js** + Tailwind + shadcn, graph on react-flow.
- **Database: PostgreSQL.**
- **Queues: BullMQ + Redis**, monitored via Bull Board.
- **LLM: custom abstraction** with OpenAI and Anthropic adapters, switchable via env.

<!-- TODO: startup guide (prerequisites, .env from .env.example, docker compose up,
     demo data, opening the app and Bull Board) once the stack exists. -->

## Architectural Decisions

<!-- Spec 9.6 requires at least 5 ADRs and must cover: deterministic-vs-LLM split,
     entity deduplication, cost control + LLM caching, provider error handling, and the
     backend choice. Each must match the real code. ADR-1 below is fully drafted; the
     rest are stubs to complete as the implementation lands. Rewrite all in your voice. -->

### ADR-1: Shared raw Articles, per-User Labelling

**Context:** Multi-tenant isolation (Principle 4) requires that one User never sees
another's data. But the same article frequently arrives for many Users, and processing it
separately per User would multiply the most expensive resource — LLM calls. Importance,
categories, and axis assignments are User-specific, so they cannot be shared.

**Decision:** Store Articles, Entities, and Mentions once, shared across Users. Store
Labelling (summary, importance, entity/category/axis assignments) and the visible Graph
per-User. Enforce isolation at the Labelling/Graph layer: every read scopes by User, and a
direct-ID request for raw Article data is gated by whether that User has a Feed or
Labelling linking to it.

**Alternatives:** (a) Duplicate every Article row per User — simplest isolation, highest
storage and LLM cost. (b) Share everything including Labelling — cheapest, but breaks
per-User categories/axes and violates isolation.

**Trade-offs:** Gained large LLM/storage savings and natural deduplication. Gave up the
simplicity of physical row separation: isolation must now be proven correct at every read
path rather than falling out of the schema.

### ADR-2: Non-enumerating auth responses

**Context:** Register returned 409 Conflict for duplicate emails while login and
resendConfirmation were non-enumerating — an inconsistency that leaked account
existence through the register endpoint alone.

**Decision:** Standardise on non-enumerating responses. Register now returns 201
Created with a synthetic response for duplicate emails, indistinguishable from a
genuine registration. Reverses the earlier "explicit duplicate-email" trade-off.

**Trade-offs:** Gained a coherent anti-enumeration stance across all public auth
endpoints. Lost the helpful "you already have an account" message for forgetful
users.

See [ADR-0002](docs/adr/0002-non-enumerating-auth-responses.md).

### ADR-3: The split between deterministic code and the LLM

<!-- TODO (required by 9.6, Principle 1). Decision: LLM only for entity extraction,
     summary, importance, category/axis assignment, fuzzy entity matching, semantic
     similarity. Everything else deterministic. Fill with the real boundaries from code. -->

### ADR-3: Entity deduplication strategy

<!-- TODO (required by 9.6, FR-6). How Microsoft / MSFT / Microsoft Corp. / Cyrillic / MS
     collapse to one Entity with a canonical name and aliases, without quadratic LLM polling. -->

### ADR-4: Cost control and LLM caching

<!-- TODO (required by 9.6, FR-10). Content-hash result cache, one LLM call per article,
     LLM_CONCURRENCY bound, per-request token limit, pre-filter as first line of saving. -->

### ADR-5: LLM provider error-handling strategy

<!-- TODO (required by 9.6, Principle 2). Retry with backoff, failover to second adapter,
     or mark awaiting and retry later. State the concrete strategy the code implements. -->

### ADR-6: Backend choice - NestJS over Directus

<!-- TODO (required by 9.6). Why NestJS: custom business logic (LLM pipeline, dedup, graph,
     workers) dominates, so out-of-the-box CRUD/admin buys little while costing integration
     friction. Record what was given up (auth, admin panel, CRUD scaffolding). -->

## Implemented from Should / Could

<!-- TODO: honest list of what is and isn't done, with known limitations. -->
