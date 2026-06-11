import {ArticleLabelProducer} from '../../src/infra/queues/article-label-producer';

/**
 * Capturing ArticleLabelProducer double for E2E tests. Keeps the harness
 * hermetic (no real Redis) the same way StubFeedPullProducer does for feed-pull.
 * Records every enqueued Article id so a test can assert exactly which label
 * jobs ingestion produced.
 */
export class StubArticleLabelProducer implements ArticleLabelProducer {
  readonly enqueued: string[] = [];

  clear(): void {
    this.enqueued.length = 0;
  }

  async enqueueLabel(articleId: string): Promise<void> {
    this.enqueued.push(articleId);
  }
}
