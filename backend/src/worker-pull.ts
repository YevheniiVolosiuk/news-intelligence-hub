import {Worker as BullWorker, Job} from 'bullmq';
import {redisConnectionOptions} from './infra/cache/redis';
import {QUEUE_FEED_PULL} from './infra/queues/queues';
import {
  IngestionService,
  PullSummary,
} from './modules/ingestion/ingestion.service';
import {
  bootstrapWorkerContext,
  createLog,
  installShutdown,
  resolvePullConcurrency,
  startHealthServer,
} from './worker-runtime';

const SERVICE = 'worker-pull';
const {logger, log} = createLog('WorkerPull');

/**
 * Feed-pull worker entrypoint (ADR-0004). Drains QUEUE_FEED_PULL at
 * WORKER_CONCURRENCY; horizontally scalable because it holds no global cap.
 * Each job hands one Feed to ingestion: job => ingestion.pullFeed(feedId).
 */
async function bootstrap(): Promise<void> {
  const ctx = await bootstrapWorkerContext(logger);
  const ingestion = ctx.get(IngestionService);

  const connection = redisConnectionOptions();
  const concurrency = resolvePullConcurrency();

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
      queue: QUEUE_FEED_PULL,
      jobId: job?.id,
      feedId: job?.data?.feedId,
      error: err.message,
    }),
  );

  const healthServer = startHealthServer(SERVICE, log);
  installShutdown(log, ctx, healthServer, () => worker.close());
}

bootstrap().catch(err => {
  log('error', 'worker.bootstrap.failed', {error: String(err)});
  process.exit(1);
});
