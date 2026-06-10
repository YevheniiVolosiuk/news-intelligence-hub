# News Intelligence Hub

## Project map

- Roadmap / current slice: `docs/ROADMAP.md`
- Domain language: `CONTEXT.md`
- Architectural decisions: `docs/adr/`
- Source of truth (local only, not committed): `SPECIFICATION.md`

## Engineering constraints

Hold for every slice:

- Google TS Style Guide; linter green; no dead code; no non-printable Unicode (zero-width, BOM, directional marks).
- Structured logs with identifiers + outcome on every worker operation (NFR-2). Never swallow errors. Logs are single-line JSON across API and worker via `common/logging/JsonLogger` (ADR-0003).
- All config via env; update `.env.example` with every new variable; no secrets in the repo.
- No LLM calls from HTTP handlers — always through the queue (Principle 3).
- The LLM is a precision tool: use it only for semantic work; do everything deterministic (parsing, hashing, dedup by URL/hash, pre-filter, graph assembly) in plain code (Principle 1).
- Tenancy enforced at the data layer, not just the UI (Principle 4); reject other Users' resources requested by direct ID. See ADR-0001.
- Meaningful commits showing progression (NFR-6) — never one big dump.

## Backend architecture

Feature-first modular monolith under `backend/src/`. Keep it pragmatic — no
Clean Architecture layers, no `application/domain/presentation` folders inside
modules.

- `modules/<domain>/` — one folder per business domain (`auth`, `users`,
  `health`, …). Controller, services, DTOs (`dto/`), and the domain's
  repositories live together. Each domain owns a `<domain>.module.ts` that
  declares its providers and `exports` what other modules consume.
- `common/` — cross-cutting, domain-agnostic code reused by 2+ modules:
  `decorators/`, `guards/`, `filters/`, `interceptors/`, `pipes/`, `utils/`.
  `common` must never import from `modules/` (dependency flows
  `modules → common`, never back).
- `infra/` — external integrations only: `database/`, `cache/`, `queues/`
  (add `mail/`, `storage/` when a real one lands). No business logic.
- `app.module.ts` — pure composition: imports the domain + infra modules,
  declares nothing of its own.
- Entrypoints (`main.ts`, `worker.ts`, `bull-board.ts`) stay at `src/` root so
  their `dist/*.js` paths stay stable for `package.json`/Docker/compose.

Rules when adding code:

- A repository lives with its domain in `modules/<domain>/`, never in another
  module. Cross-domain access goes through the owning module's `exports`
  (e.g. `AuthModule` imports `UsersModule` to use `UsersRepository`).
- Shared types travel with the shared abstraction, not a feature service
  (e.g. `AuthenticatedUser` lives in `common/decorators/current-user.decorator`).
- Don't create empty scaffolding folders — add an `infra/*` or `common/*`
  subfolder only when the first real file arrives.
- Watch for circular imports between modules; if two domains need each other,
  the shared piece belongs in `common`.

## Database migrations

Single-concern TypeScript migrations using `node-pg-migrate` v8. Each migration
is a `.ts` file exporting **only** `up(pgm: MigrationBuilder)` — no `down()`.
The DBs are disposable (Testcontainers / early-stage), so rollback is
unnecessary. Each file represents one structural idea using the fluent
`MigrationBuilder` DSL (`pgm.createTable`, `pgm.addColumns`,
`pgm.addConstraint`, `pgm.createIndex`, `pgm.createExtension`, `pgm.func`, and
`pgm.sql` as an escape hatch for raw SQL).

**Design principle:** tables define structure, constraints define policy, indexes
define performance, state columns define workflow. Each should be in its own
migration so it can evolve independently.

**Location / naming:**
`backend/src/infra/database/migrations/1000000000XXX_<domain>_<action>.ts`

The 13-digit zero-padded prefix is a synthetic timestamp that sorts correctly
and avoids node-pg-migrate's log noise for non-timestamp prefixes. Gaps between
groups (001–002, 010–011, 020, 030–031, 040, 050) leave room for future
insertions.

To add a new migration: create the file manually following the convention. Pick
the next prefix in the appropriate group gap.

**Command:** `npm run migrate` — apply all pending migrations.

**Loader:** the CLI is invoked under `tsx` (devDependency), which transparently
compiles `.ts` migration files regardless of the repo's `module: commonjs`
tsconfig. The CLI is shelled out (`migrate.ts`) and the same path serves API
boot, `npm run migrate`, and the Testcontainers harness.

**Cascade policy (ADR-0001):** owned/private rows cascade with their owner;
shared rows detach. Examples: `feeds.user_id` → `ON DELETE CASCADE` (owned
subscription), `articles.feed_id` → `ON DELETE SET NULL` (shared content).

**Comments:** each migration carries the relevant ADR / cascade rationale inline.

**Data-layer-only slices** are proven at the SQL boundary — see
`test/support/migration-harness.ts` and
`test/infra/articles-sources-schema.spec.ts`.

**Production note:** migrations execute in dev/test; running them in the prod
image needs `tsx` in the runtime (or compiled migrations) — tracked separately.

## Frontend styling

- shadcn/ui (New York, `slate` base) is the component system. Add components with
  `npx shadcn@latest add <name>` — config in `frontend/components.json`. The
  `@shadcn-space` registry is wired up for community blocks.
- Style with the semantic CSS-variable tokens, never hardcoded palette colors:
  use `bg-background`/`text-foreground`/`bg-card`/`text-muted-foreground`/
  `border-border`/`bg-primary`/`text-destructive`, not `bg-slate-950`,
  `text-emerald-400`, etc. Tokens live in `frontend/app/globals.css`
  (`:root` + `.dark`) and map through `frontend/tailwind.config.ts`.
- The app runs dark by default (`<html class="dark">` in `app/layout.tsx`).
  Keep new pages legible in both themes via the tokens above.
- Registry blocks often ship as static demos with sample branding and dead
  buttons — strip those, keep the visual treatment, and wire real logic in.

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, each mapped 1:1 to its default label string. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
