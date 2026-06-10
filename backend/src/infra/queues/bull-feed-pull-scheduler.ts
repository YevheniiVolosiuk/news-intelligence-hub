import {Injectable, Logger, OnModuleDestroy} from '@nestjs/common';
import {Queue} from 'bullmq';
import {redisConnectionOptions} from '../cache/redis';
import {FeedPullScheduler, feedSchedulerId} from './feed-pull-scheduler';
import {QUEUE_FEED_PULL} from './queues';

/** Default pull cadence when FEED_PULL_INTERVAL_MS is unset (15 minutes). */
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

/** Read the configured pull interval, falling back to the default. */
export function pullIntervalMs(): number {
  const raw = Number(process.env.FEED_PULL_INTERVAL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INTERVAL_MS;
}

/**
 * BullMQ-backed scheduler: maintains one repeatable job per active Feed via the
 * Job Scheduler API. `feed:<id>` is the scheduler key, so register is an upsert
 * (idempotent) and remove leaves no orphan. Reconcile diffs the live schedulers
 * against the active set on startup. Shares the `feed-pull` queue the worker
 * drains; the Queue is closed on shutdown so the process can exit cleanly.
 */
@Injectable()
export class BullFeedPullScheduler
  implements FeedPullScheduler, OnModuleDestroy
{
  private readonly logger = new Logger(BullFeedPullScheduler.name);
  private readonly queue = new Queue(QUEUE_FEED_PULL, {
    connection: redisConnectionOptions(),
  });

  async schedule(feedId: string): Promise<void> {
    const id = feedSchedulerId(feedId);
    await this.queue.upsertJobScheduler(
      id,
      {every: pullIntervalMs()},
      {name: 'pull', data: {feedId}},
    );
    this.logger.log(
      `schedule outcome=registered schedulerId=${id} feedId=${feedId}`,
    );
  }

  async unschedule(feedId: string): Promise<void> {
    const id = feedSchedulerId(feedId);
    await this.queue.removeJobScheduler(id);
    this.logger.log(
      `unschedule outcome=removed schedulerId=${id} feedId=${feedId}`,
    );
  }

  async reconcile(activeFeedIds: string[]): Promise<void> {
    const wanted = new Set(activeFeedIds.map(feedSchedulerId));
    const existing = await this.queue.getJobSchedulers(0, -1);

    for (const scheduler of existing) {
      if (!wanted.has(scheduler.key)) {
        await this.queue.removeJobScheduler(scheduler.key);
      }
    }
    for (const feedId of activeFeedIds) {
      await this.schedule(feedId);
    }
    // The `reconcile outcome=synced` line is emitted once by FeedPullReconciler,
    // the orchestration seam that calls this method; not duplicated here.
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close().catch(() => undefined);
  }
}
