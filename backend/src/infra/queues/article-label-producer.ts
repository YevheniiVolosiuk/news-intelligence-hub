/**
 * Injectable seam for enqueuing a one-shot article-label job.
 *
 * Mirrors the FeedPullProducer pattern: injectable interface + DI token,
 * BullMQ-backed production impl, capturing double in tests. Ingestion only
 * produces label jobs; the LLM is reached from the worker that drains them,
 * never inline from an HTTP handler (Principle 3).
 */
export interface ArticleLabelProducer {
  /** Enqueue a single article-label job carrying the Article's id. */
  enqueueLabel(articleId: string): Promise<void>;
}

export const ARTICLE_LABEL_PRODUCER = Symbol('ArticleLabelProducer');
