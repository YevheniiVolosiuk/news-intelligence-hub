/**
 * Queue registry. Workers and Bull Board both import from here so the set of
 * queue names has a single source of truth. New slices add their queues here.
 */
export const QUEUE_FEED_PULL = 'feed-pull';
export const QUEUE_ARTICLE_LABEL = 'article-label';

export const ALL_QUEUES: readonly string[] = [
  QUEUE_FEED_PULL,
  QUEUE_ARTICLE_LABEL,
];

/**
 * Per-job retry policy for `article-label` (Slice 4.6). A provider outage is
 * transient, so a job gets `attempts` tries with exponential backoff before the
 * labelling flow defers its Article to `awaiting`. The worker reads
 * `job.attemptsMade` against `attempts` to know which run is the final one. A
 * validation failure short-circuits inside the flow and never burns these tries.
 */
export const ARTICLE_LABEL_MAX_ATTEMPTS = 4;

export const ARTICLE_LABEL_JOB_OPTS = {
  attempts: ARTICLE_LABEL_MAX_ATTEMPTS,
  backoff: {type: 'exponential' as const, delay: 5000},
};
