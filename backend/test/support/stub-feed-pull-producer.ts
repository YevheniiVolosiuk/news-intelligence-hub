import {FeedPullProducer} from '../../src/infra/queues/feed-pull-producer';

/**
 * Capturing FeedPullProducer double for E2E tests. Keeps the harness hermetic
 * (no real Redis) the same way StubFeedFetcher replaces the network. Records
 * every enqueued feed id so a test can assert exactly which jobs were produced.
 */
export class StubFeedPullProducer implements FeedPullProducer {
  readonly enqueued: string[] = [];

  clear(): void {
    this.enqueued.length = 0;
  }

  async enqueuePull(feedId: string): Promise<void> {
    this.enqueued.push(feedId);
  }
}
