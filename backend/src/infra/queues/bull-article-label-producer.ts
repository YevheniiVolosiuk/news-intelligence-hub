import {Injectable, Logger, OnModuleDestroy} from '@nestjs/common';
import {Queue} from 'bullmq';
import {redisConnectionOptions} from '../cache/redis';
import {ArticleLabelProducer} from './article-label-producer';
import {ARTICLE_LABEL_JOB_OPTS, QUEUE_ARTICLE_LABEL} from './queues';

/**
 * BullMQ-backed producer that owns the producing side of the `article-label`
 * queue. It holds one `Queue` over a Redis connection and adds a single job per
 * ingested pending Article; the label worker is the consumer. The Queue is
 * closed on shutdown so the process can exit cleanly.
 */
@Injectable()
export class BullArticleLabelProducer
  implements ArticleLabelProducer, OnModuleDestroy
{
  private readonly logger = new Logger(BullArticleLabelProducer.name);
  private readonly queue = new Queue(QUEUE_ARTICLE_LABEL, {
    connection: redisConnectionOptions(),
  });

  async enqueueLabel(articleId: string): Promise<void> {
    // Retry on provider outage with exponential backoff; on exhaustion the
    // labelling flow defers the Article to `awaiting` (Slice 4.6). A validation
    // failure fast-fails inside the flow without consuming these attempts.
    const job = await this.queue.add(
      'label',
      {articleId},
      ARTICLE_LABEL_JOB_OPTS,
    );
    this.logger.log(
      `enqueue-label outcome=enqueued queue=${QUEUE_ARTICLE_LABEL} jobId=${job.id} articleId=${articleId}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close().catch(() => undefined);
  }
}
