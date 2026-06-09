# Build Roadmap

The ordered list of vertical slices for News Intelligence Hub. This is the **map**, not
the detail — task-level work lives in GitHub issues (`/to-issues`). Each session: open
this file, find the current slice, continue.

**Vocabulary:** use the terms from [CONTEXT.md](../CONTEXT.md). Decisions go in
[docs/adr/](./adr/). Always-on engineering rules live in [AGENTS.md](../AGENTS.md).

**Per-slice flow:** `(/grill-with-docs if design-heavy)` -> `/to-prd` -> `/to-issues` -> `/tdd`.
Build one slice top-to-bottom (DB -> API -> worker -> UI) before starting the next.

> **Don't forget — grill the `_grill first_` slices (4 and 5) before writing their PRD.**
> Run `/grill-with-docs` *before* `/to-prd` on the LLM pipeline (Slice 4) and deduplication
> (Slice 5). That is where the 25-point Architecture score is won and where the spec
> deliberately leaves the design to you — going straight to `/to-prd` lets the agent invent
> the design instead of you owning it. The easy slices (auth, feed CRUD) can skip the grill.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · **(Must)** gate · **(Should)** bonus · **(Could)** bonus

---

## Phase 0 — Foundations

- [x] Domain glossary + tenancy ADR (`/grill-with-docs`)
- [x] Git repo + skeleton (`backend/`, `frontend/`, `.docker/`, `Makefile`)
- [x] Engineering skills wired (`/setup-matt-pocock-skills`: GitHub tracker, labels, domain docs)
- [x] `docker compose up` boots the empty stack (Postgres, Redis, backend, frontend, worker, Bull Board) — **(Must)** de-risks the §9.3 gate early

## Phase 1 — Must slices (the acceptance gate, §9.4)

- [~] **Slice 1 — Auth + tenancy** **(Must)** · §9.4 steps 3-6
      Register, email confirm (dev mode: link in log/UI), login, logout, session survives reload.
      _1.1 register + dev-mode confirmation link done; 1.2 confirm/resend, 1.3 login/logout/session, 1.4 tenant scoping remain._
      Passwords hashed (argon2/bcrypt). Tenancy enforced at the data-access layer per ADR-0001.
- [ ] **Slice 2 — Feed CRUD + status** **(Must)** · §9.4 step 7
      Add Feed by URL, validate RSS/Atom + reachability, pause/resume/delete, show status.
      Delete detaches Articles, does not remove them.
- [ ] **Slice 3 — Ingestion + Pre-Filter** **(Must)** · §9.4 step 8
      Feed-pull worker (scheduled + manual), RSS/Atom parse, URL normalisation, content hash,
      deterministic Pre-Filter (`filtered`/`pending`). Demo-data seed for review.
- [ ] **Slice 4 — LLM abstraction + Labelling** **(Must)** · §9.4 step 9 · _grill first_
      `LlmService` + OpenAI & Anthropic adapters (env switch), queue-only calls, structured/validated
      output, content-hash cache, one call per Article, Telemetry, `LLM_CONCURRENCY` + token limit.
- [ ] **Slice 5 — Deduplication** **(Must)** · §9.4 step 9 · _grill first_
      Article dedup (URL/hash -> Duplicate folded, "N similar" counter), Entity dedup
      (Canonical Name + Aliases merge: Microsoft/MSFT/MS/Cyrillic). No quadratic LLM polling.
- [ ] **Slice 6 — Categories + Axes** **(Must)** · §9.4 step 13 (setup)
      Category CRUD (no LLM), Axis + Axis Value CRUD with 4-5 seeds, applied during Labelling.
- [ ] **Slice 7 — Article feed + cards** **(Must)** · §9.4 steps 9-11
      Article list with filters (Category, Feed, Importance, time window, Processing State),
      Article card, Entity card.
- [ ] **Slice 8 — Relationship Graph** **(Must)** · §9.4 step 12
      react-flow, article + entity nodes, typed edges (Mention, Co-mention), filters by node type
      + Category, side panel on click, explicit Graph Rebuild action.
- [ ] **Slice 9 — Regeneration** **(Must)** · §9.4 step 13
      Trigger after Axis change, background via queue, progress, cache reuse, ends in Graph Rebuild,
      UI stays responsive.
- [ ] **Slice 10 — Bull Board** **(Must)** · §9.4 step 15
      Mounted with basic auth from env, admin "Open queues" link behind env flag.
- [ ] **Slice 11 — One-command startup** **(Must)** · §9.4 step 1
      `docker compose up` brings up full stack + auto migrations/seeds + demo data. README startup guide.
- [ ] **Slice 12 — README + ADRs** **(Must, scored §9.6/§9.7)**
      >=5 ADRs in README format, matching real code (deterministic-vs-LLM split, entity dedup,
      cost control/caching, provider error-handling, NestJS-vs-Directus). Honest Should/Could list.

## Phase 2 — Should (bonus, after Must is green)

- [ ] Provider failover on LLM error (Principle 2)
- [ ] Meaningful unit tests on critical parts (adapters, RSS parse, Pre-Filter, dedup)
- [ ] Extended graph filters: time window + text search
- [ ] Period Digests (§9.4 step 14)
- [ ] Telemetry dashboard in the UI

## Phase 3 — Could (bonus)

- [ ] Semantic edges between Articles (semantic similarity)
- [ ] Graph timeline mode (slider) / edge animation along timestamp
- [ ] Visual clustering by Category
- [ ] Top entities/categories dashboard for a period
- [ ] Full-text Article search
- [ ] Graph export
