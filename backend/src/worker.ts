import {createServer} from 'node:http';
import {Job, Worker} from 'bullmq';
import {redisConnectionOptions} from './infra/cache/redis';
import {QUEUE_FEED_PULL} from './infra/queues/queues';

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

const connection = redisConnectionOptions();
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 5);

// Skeleton processor: real feed-pull / processing logic lands in later slices.
// For now it proves the worker connects to Redis and drains the queue.
const worker = new Worker(
  QUEUE_FEED_PULL,
  async (job: Job) => {
    log('info', 'job.process', {
      queue: QUEUE_FEED_PULL,
      jobId: job.id,
      name: job.name,
    });
    return {ok: true};
  },
  {connection, concurrency},
);

worker.on('ready', () =>
  log('info', 'worker.ready', {queue: QUEUE_FEED_PULL, concurrency}),
);
worker.on('failed', (job, err) =>
  log('error', 'job.failed', {jobId: job?.id, error: err.message}),
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
  healthServer.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
