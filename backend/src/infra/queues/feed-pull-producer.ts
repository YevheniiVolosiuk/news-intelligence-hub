/**
 * Injectable seam for enqueuing a one-shot feed-pull job.
 *
 * Mirrors the FeedFetcher/FeedValidator pattern: injectable interface + DI
 * token, BullMQ-backed production impl, capturing double in tests. The API
 * never runs ingestion inline (Principle 3) — it only produces jobs that the
 * worker drains.
 */
export interface FeedPullProducer {
  /** Enqueue a single feed-pull job carrying the Feed's id. */
  enqueuePull(feedId: string): Promise<void>;
}

export const FEED_PULL_PRODUCER = Symbol('FeedPullProducer');
