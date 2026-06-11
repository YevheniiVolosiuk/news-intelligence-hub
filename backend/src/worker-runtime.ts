import {createServer, IncomingMessage, ServerResponse, Server} from 'node:http';
import {INestApplicationContext} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {JsonLogger} from './common/logging/json-logger';
import {WorkerModule} from './worker.module';

/**
 * Shared scaffolding for the two worker entrypoints (ADR-0004): `worker-pull`
 * and `worker-label`. The thin entrypoints keep their BullMQ consumer logic;
 * everything else — context boot, logging, health server, shutdown, concurrency
 * resolution — lives behind this small surface so the split stays DRY.
 */

type Env = Record<string, string | undefined>;

export type Log = (
  level: 'info' | 'error',
  msg: string,
  extra?: Record<string, unknown>,
) => void;

/** Extra HTTP routes a worker mounts beside the always-on `GET /health`. */
export type HealthRoute = (
  req: IncomingMessage,
  res: ServerResponse,
) => boolean | Promise<boolean>;

/**
 * Concurrency for the article-label worker. Reads `LLM_CONCURRENCY` so the
 * single-replica `worker-label` (ADR-0004) is an exact global cap on in-flight
 * LLM calls. Default mirrors `.env.example`.
 */
export function resolveLabelConcurrency(env: Env = process.env): number {
  return Number(env.LLM_CONCURRENCY ?? 2);
}

/**
 * Concurrency for the feed-pull worker. Reads `WORKER_CONCURRENCY`, the knob
 * `worker-pull` scales on independently of the LLM cap. Default mirrors
 * `.env.example`.
 */
export function resolvePullConcurrency(env: Env = process.env): number {
  return Number(env.WORKER_CONCURRENCY ?? 5);
}

/**
 * Single-line JSON `log` helper bound to a shared `JsonLogger`, matching the
 * format used across API and worker (ADR-0003).
 */
export function createLog(context: string): {logger: JsonLogger; log: Log} {
  const logger = new JsonLogger();
  const log: Log = (level, msg, extra = {}) => {
    const message = {msg, ...extra};
    if (level === 'error') {
      logger.error(message, context);
    } else {
      logger.log(message, context);
    }
  };
  return {logger, log};
}

/**
 * Boot the worker's NestJS ApplicationContext (no HTTP server) so it shares DI,
 * the Postgres pool, and the FeedFetcher/Pre-Filter/LLM seams with the API.
 */
export async function bootstrapWorkerContext(
  logger: JsonLogger,
): Promise<INestApplicationContext> {
  const ctx = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  ctx.useLogger(logger);
  return ctx;
}

/**
 * Tiny HTTP server giving the container a meaningful liveness check. Always
 * serves `GET /health` -> `{ok, service}`; extra operator routes (e.g. the
 * label worker's `POST /redrain`) are tried first and may handle the request.
 * Listens on `WORKER_HEALTH_PORT` (default 3000).
 */
export function startHealthServer(
  service: string,
  log: Log,
  routes: HealthRoute[] = [],
): Server {
  const port = Number(process.env.WORKER_HEALTH_PORT ?? 3000);
  const server = createServer((req, res) => {
    void (async () => {
      for (const route of routes) {
        if (await route(req, res)) return;
      }
      if (req.url === '/health') {
        res.writeHead(200, {'content-type': 'application/json'});
        res.end(JSON.stringify({ok: true, service}));
        return;
      }
      res.writeHead(404);
      res.end();
    })();
  });
  server.listen(port, '0.0.0.0', () =>
    log('info', 'worker.health.listening', {port, service}),
  );
  return server;
}

/**
 * Register SIGTERM/SIGINT handlers for a graceful shutdown: close the BullMQ
 * worker(s) via `onClose`, then the Nest context and health server, then exit.
 */
export function installShutdown(
  log: Log,
  ctx: INestApplicationContext,
  healthServer: Server,
  onClose: () => Promise<void>,
): void {
  const shutdown = async (signal: string): Promise<void> => {
    log('info', 'worker.shutdown', {signal});
    await onClose();
    await ctx.close();
    healthServer.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
