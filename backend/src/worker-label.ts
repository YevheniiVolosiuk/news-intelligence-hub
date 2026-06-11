import {IncomingMessage, ServerResponse} from 'node:http';
import {Worker as BullWorker, Job} from 'bullmq';
import {redisConnectionOptions} from './infra/cache/redis';
import {QUEUE_ARTICLE_LABEL} from './infra/queues/queues';
import {LabellingService} from './modules/labelling/labelling.service';
import {
  bootstrapWorkerContext,
  createLog,
  installShutdown,
  resolveLabelConcurrency,
  startHealthServer,
} from './worker-runtime';

const SERVICE = 'worker-label';
const {logger, log} = createLog('WorkerLabel');

/**
 * Article-label worker entrypoint (ADR-0004). Drains QUEUE_ARTICLE_LABEL at
 * concurrency = LLM_CONCURRENCY. Runs as a single replica (see
 * docker-compose.prod.yml) so LLM_CONCURRENCY is an exact global cap on
 * in-flight LLM calls without a distributed semaphore. Each job hands one
 * Article to the labelling flow: job => labelArticle(articleId).
 */
async function bootstrap(): Promise<void> {
  const ctx = await bootstrapWorkerContext(logger);
  const labelling = ctx.get(LabellingService);

  const connection = redisConnectionOptions();
  const concurrency = resolveLabelConcurrency();

  const worker = new BullWorker<{articleId: string}, void>(
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

  worker.on('ready', () =>
    log('info', 'worker.ready', {queue: QUEUE_ARTICLE_LABEL, concurrency}),
  );
  worker.on('failed', (job, err) =>
    log('error', 'job.failed', {
      queue: QUEUE_ARTICLE_LABEL,
      jobId: job?.id,
      articleId: job?.data?.articleId,
      error: err.message,
    }),
  );

  // Manual re-drain trigger (Slice 4.6): a system-level POST that re-enqueues
  // every `awaiting` Article once the provider has recovered. It lives on the
  // label worker — the consumer of QUEUE_ARTICLE_LABEL — rather than the
  // tenant-scoped API because re-drain is a cross-tenant operator action.
  const redrain = (req: IncomingMessage, res: ServerResponse): boolean => {
    if (req.url !== '/redrain' || req.method !== 'POST') return false;
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
    return true;
  };

  const healthServer = startHealthServer(SERVICE, log, [redrain]);
  installShutdown(log, ctx, healthServer, () => worker.close());
}

bootstrap().catch(err => {
  log('error', 'worker.bootstrap.failed', {error: String(err)});
  process.exit(1);
});
