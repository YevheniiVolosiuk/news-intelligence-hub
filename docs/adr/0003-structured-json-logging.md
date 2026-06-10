# Structured JSON logging across API and worker

All backend processes — the HTTP API and the BullMQ worker — emit logs as
single-line JSON on stdout (stderr for `error`/`fatal`). There is one log format
across the stack and no per-process exception.

## Context

Slice 3 (Ingestion + Pre-Filter) ended with two structured-logging styles side
by side. The worker (`worker.ts`) hand-built single-line JSON, while every
Nest-side component used the default Nest `Logger`, whose output is
human-readable text with the payload encoded as `key=value` inside the message
string. The Slice 3 review (#31) flagged the split: both are greppable, but only
the worker's was machine-parseable, and the text-with-`key=value` lines are not
ingestible by a log shipper without bespoke regex. NFR-2 calls for structured
logs with identifiers and outcome on every operation; the project is heading
toward queue monitoring (Bull Board, Slice 10) and cost telemetry (Slice 4),
where logs will be shipped and queried rather than eyeballed.

## Decision

Standardise on **structured JSON lines everywhere**, via a small in-house
`JsonLogger` (a Nest `LoggerService`) wired with `app.useLogger(...)` on the API
and `ctx.useLogger(...)` on the worker context. Components keep using the
standard Nest `Logger`; their output is routed through the JSON formatter, so no
call site had to change to adopt the format. The worker's hand-rolled logger is
deleted and its events go through the same `JsonLogger`, preserving its
structured fields (an object message has its `msg`/`message` used as the text
and remaining keys spread as top-level fields).

A custom `LoggerService` was chosen over a library (e.g. `nestjs-pino`) because
the need is narrow — one JSON envelope, stdout/stderr split — and it adds no
dependency while matching the worker's existing line shape.

## Alternatives

(a) `nestjs-pino` — battle-tested, levels/redaction/request-logging for free,
but a new dependency and bootstrap surface for a need a few lines cover.
(b) Keep both formats and document the worker as a deliberate exception — zero
effort now, but institutionalises two formats and the tax grows with every new
module and the day logs are aggregated.

## Trade-offs

Gained one machine-parseable format across every process, set before the log
volume grows. The `outcome=`/`key=value` convention still lives inside the `msg`
field on Nest-side logs (not yet promoted to first-class JSON keys); those may be
migrated to object-form fields opportunistically — the envelope is already
consistent. Maps to NFR-2 (structured logs on every operation).
