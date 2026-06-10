import {createServer} from 'node:http';
import {Worker as BullWorker, Job} from 'bullmq';
import {NestFactory} from '@nestjs/core';
import {redisConnectionOptions} from './infra/cache/redis';
import {QUEUE_FEED_PULL} from './infra/queues/queues';
import {WorkerModule} from './worker.module';
import {IngestionService, PullSummary} from './modules/ingestion/ingestion.service';

/** Structured single-line log so worker output is greppable in `docker logs`. */
function log(
  level: 'info' | 'error',
  msg: string,
  extra: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    level,
    msg,
    ts: Math.floor(Date.now() / 1000),
    ...extra,
  });
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

async function bootstrap(): Promise<void> {
  // Bootstrap NestJS ApplicationContext so the worker shares DI,
  // Postgres pool, parser, Pre-Filter, and FeedFetcher with the API.
  const ctx = await NestFactory.createApplicationContext(WorkerModule);
  const ingestion = ctx.get(IngestionService);

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
    log('error', 'job.failed', {jobId: job?.id, feedId: job?.data?.feedId, error: err.message}),
  );

  // Tiny HTTP endpoint so the container has a meaningful health check.
  const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 3000);
  const healthServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, {'content-type': 'application/json'});
      res.end(JSON.stringify({ok: true, service: 'worker'}));
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
    await ctx.close();
    healthServer.close();
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  log('error', 'worker.bootstrap.failed', {error: String(err)});
  process.exit(1);
});
