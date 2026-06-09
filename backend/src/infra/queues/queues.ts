/**
 * Queue registry. Workers and Bull Board both import from here so the set of
 * queue names has a single source of truth. New slices add their queues here.
 */
export const QUEUE_FEED_PULL = 'feed-pull';

export const ALL_QUEUES: readonly string[] = [QUEUE_FEED_PULL];
