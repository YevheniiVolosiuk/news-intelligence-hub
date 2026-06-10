import {Injectable, Logger, OnModuleDestroy} from '@nestjs/common';
import {Queue} from 'bullmq';
import {redisConnectionOptions} from '../cache/redis';
import {FeedPullProducer} from './feed-pull-producer';
import {QUEUE_FEED_PULL} from './queues';

/**
 * BullMQ-backed producer that owns the API side of the `feed-pull` queue. It
 * holds one `Queue` over a Redis connection and adds a single job per pull
 * request; the worker (Slice 3.6) is the consumer. The Queue is closed on
 * shutdown so the process can exit cleanly.
 */
@Injectable()
export class BullFeedPullProducer implements FeedPullProducer, OnModuleDestroy {
  private readonly logger = new Logger(BullFeedPullProducer.name);
  private readonly queue = new Queue(QUEUE_FEED_PULL, {
    connection: redisConnectionOptions(),
  });

  async enqueuePull(feedId: string): Promise<void> {
    const job = await this.queue.add('pull', {feedId});
    this.logger.log(
      `enqueue-pull outcome=enqueued queue=${QUEUE_FEED_PULL} jobId=${job.id} feedId=${feedId}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close().catch(() => undefined);
  }
}
