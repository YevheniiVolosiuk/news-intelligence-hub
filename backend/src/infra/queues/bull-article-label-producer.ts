import {Injectable, Logger, OnModuleDestroy} from '@nestjs/common';
import {Queue} from 'bullmq';
import {redisConnectionOptions} from '../cache/redis';
import {ArticleLabelProducer} from './article-label-producer';
import {QUEUE_ARTICLE_LABEL} from './queues';

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
    const job = await this.queue.add('label', {articleId});
    this.logger.log(
      `enqueue-label outcome=enqueued queue=${QUEUE_ARTICLE_LABEL} jobId=${job.id} articleId=${articleId}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close().catch(() => undefined);
  }
}
