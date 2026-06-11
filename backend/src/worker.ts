import {createServer} from 'node:http';
import {Worker as BullWorker, Job} from 'bullmq';
import {NestFactory} from '@nestjs/core';
import {JsonLogger} from './common/logging/json-logger';
import {redisConnectionOptions} from './infra/cache/redis';
import {QUEUE_ARTICLE_LABEL, QUEUE_FEED_PULL} from './infra/queues/queues';
import {WorkerModule} from './worker.module';
import {
  IngestionService,
  PullSummary,
} from './modules/ingestion/ingestion.service';
import {LabellingService} from './modules/labelling/labelling.service';

const WORKER_CONTEXT = 'Worker';
const logger = new JsonLogger();

/** Structured single-line log, sharing the JSON format used across the stack. */
function log(
  level: 'info' | 'error',
  msg: string,
  extra: Record<string, unknown> = {},
): void {
  const message = {msg, ...extra};
  if (level === 'error') {
    logger.error(message, WORKER_CONTEXT);
  } else {
    logger.log(message, WORKER_CONTEXT);
  }
}

async function bootstrap(): Promise<void> {
  // Bootstrap NestJS ApplicationContext so the worker shares DI,
  // Postgres pool, parser, Pre-Filter, and FeedFetcher with the API.
  const ctx = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  ctx.useLogger(logger);
  const ingestion = ctx.get(IngestionService);
  const labelling = ctx.get(LabellingService);

  const connection = redisConnectionOptions();
  const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 5);

  const worker = new BullWorker<{feedId: string}, PullSummary>(
    QUEUE_FEED_PULL,
    async (job: Job) => {
      const feedId: string = job.data.feedId;
      const summary = await ingestion.pullFeed(feedId);

      log('info', 'job.completed', {
        queue: QUEUE_FEED_PULL,
        jobId: job.id,
        feedId,
        pulled: summary.pulled,
        inserted: summary.inserted,
        filtered: summary.filtered,
        skipped: summary.skipped,
      });

      return summary;
    },
    {connection, concurrency},
  );

  worker.on('ready', () =>
    log('info', 'worker.ready', {queue: QUEUE_FEED_PULL, concurrency}),
  );
  worker.on('failed', (job, err) =>
    log('error', 'job.failed', {
      jobId: job?.id,
      feedId: job?.data?.feedId,
      error: err.message,
    }),
  );

  // Second consumer: drain the article-label queue. Each job hands one ingested
  // Article to the labelling flow, which reaches the LLM and persists a
  // Labelling. Mirrors the feed-pull processor: job => labelArticle(articleId).
  const labelWorker = new BullWorker<{articleId: string}, void>(
    QUEUE_ARTICLE_LABEL,
    async (job: Job) => {
      const articleId: string = job.data.articleId;

      // On the final attempt an exhausted provider outage defers the Article to
      // `awaiting` rather than re-throwing; earlier attempts re-throw so BullMQ
      // retries with backoff. `attemptsMade` is the count of prior runs.
      const maxAttempts = job.opts.attempts ?? 1;
      const finalAttempt = job.attemptsMade + 1 >= maxAttempts;
      await labelling.labelArticle(articleId, {finalAttempt});

      log('info', 'job.completed', {
        queue: QUEUE_ARTICLE_LABEL,
        jobId: job.id,
        articleId,
      });
    },
    {connection, concurrency},
  );

  labelWorker.on('ready', () =>
    log('info', 'worker.ready', {queue: QUEUE_ARTICLE_LABEL, concurrency}),
  );
  labelWorker.on('failed', (job, err) =>
    log('error', 'job.failed', {
      queue: QUEUE_ARTICLE_LABEL,
      jobId: job?.id,
      articleId: job?.data?.articleId,
      error: err.message,
    }),
  );

  // Tiny HTTP endpoint so the container has a meaningful health check, plus the
  // manual re-drain trigger (Slice 4.6): a system-level POST that re-enqueues
  // every `awaiting` Article once the provider has recovered. It lives on the
  // worker's own server rather than the tenant-scoped API because re-drain is a
  // cross-tenant operator action, not a per-User request.
  const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 3000);
  const healthServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, {'content-type': 'application/json'});
      res.end(JSON.stringify({ok: true, service: 'worker'}));
      return;
    }
    if (req.url === '/redrain' && req.method === 'POST') {
      labelling
        .redrainAwaiting()
        .then(reEnqueued => {
          log('info', 'worker.redrain', {reEnqueued});
          res.writeHead(200, {'content-type': 'application/json'});
          res.end(JSON.stringify({ok: true, reEnqueued}));
        })
        .catch(err => {
          log('error', 'worker.redrain.failed', {error: String(err)});
          res.writeHead(500, {'content-type': 'application/json'});
          res.end(JSON.stringify({ok: false}));
        });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  healthServer.listen(healthPort, '0.0.0.0', () =>
    log('info', 'worker.health.listening', {port: healthPort}),
  );

  async function shutdown(signal: string): Promise<void> {
    log('info', 'worker.shutdown', {signal});
    await worker.close();
    await labelWorker.close();
    await ctx.close();
    healthServer.close();
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch(err => {
  log('error', 'worker.bootstrap.failed', {error: String(err)});
  process.exit(1);
});
