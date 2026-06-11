# Split the worker into worker-pull and worker-label

The single `worker` process is split into two independently deployed services:
`worker-pull` (drains the feed-pull queue) and `worker-label` (drains the
article-label queue and reaches the LLM). `worker-label` runs at
`concurrency = LLM_CONCURRENCY` and is pinned to **`replicas = 1`**; `worker-pull`
runs at `WORKER_CONCURRENCY` and scales horizontally.

## Context

Through Slice 4, one `worker` process hosted both BullMQ consumers: feed-pull
(RSS fetch + parse + Pre-Filter, all deterministic) and article-label (the
LLM call). Two problems followed from sharing a process and a compose service:

1. **The LLM concurrency cap was not real.** The label consumer was constructed
   with `WORKER_CONCURRENCY`, not `LLM_CONCURRENCY`, and the `worker` service
   could be scaled to N replicas. Total in-flight LLM calls were therefore
   `concurrency × replicas` — so `LLM_CONCURRENCY` capped nothing globally. The
   LLM is the project's cost and rate-limit bottleneck (Slice 4 telemetry, the
   token/timeout budget), and an inexact cap risks both provider 429s and spend.
2. **Ingestion and labelling could not scale apart.** Feed-pull is cheap,
   deterministic, and embarrassingly parallel; labelling is expensive and
   rate-limited. Bound together they had to share one concurrency knob and one
   replica count, so you could not add pull throughput without also multiplying
   LLM concurrency.

## Decision

Split into two entrypoints sharing the same image and `WorkerModule` DI context,
selected by the compose `command:`:

- **`worker-pull`** (`dist/worker-pull.js`) — feed-pull worker at
  `WORKER_CONCURRENCY`. Stateless and **horizontally scalable**; raising its
  replica count raises pull throughput and touches nothing LLM-related.
- **`worker-label`** (`dist/worker-label.js`) — article-label worker at
  `concurrency = LLM_CONCURRENCY`, and **pinned to `replicas = 1`** in
  `docker-compose.prod.yml`. It also hosts the operator `POST /redrain` endpoint
  (re-enqueues `awaiting` Articles), which belongs with the queue's consumer.

**The single-replica pin is the invariant.** With exactly one label process,
`LLM_CONCURRENCY` is an exact global ceiling on concurrent LLM calls — no
coordination needed. The shared concurrency knobs are resolved in one place
(`resolvePullConcurrency` / `resolveLabelConcurrency` in `worker-runtime.ts`) and
the `replicas = 1` invariant is guarded by a test (`worker-topology.spec.ts`) and
an inline compose comment, in addition to the human review this change gated on.

## Alternatives

(a) **Keep one worker, just fix the concurrency source** (use `LLM_CONCURRENCY`
for the label consumer). Fixes the per-process number but not the
`× replicas` multiplication, and still couples pull and label scaling. Rejected.
(b) **Redis-backed distributed semaphore** around the LLM call, allowing many
label replicas to share a global budget. This is the correct design *if* the
label tier must scale horizontally — but it adds a distributed-locking
dependency and failure mode for a need that does not exist yet at this stage.
Deferred (see below). (c) **Separate images per entrypoint** — needless; the
build artefact is identical and the entrypoint is a one-token `command:` choice.

## Trade-offs

Gained an exact, coordination-free global LLM cap and independent scaling of
ingestion, at the cost of one more long-running service and the discipline of the
`replicas = 1` invariant (which is advisory under plain `docker compose` and
enforced under an orchestrator — hence the test, the comment, and the HITL
review). Maps to Principle 3 (LLM only via the queue) and the Slice 4 cost
controls.

## Out of scope / future

A horizontally-scaled label tier would **replace** the single-replica invariant
with the Redis-backed distributed semaphore from alternative (b): each replica
acquires one of `LLM_CONCURRENCY` global slots before calling the provider and
releases it after. That is the documented upgrade path when one label process is
no longer enough; it is intentionally not built here.
