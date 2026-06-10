/**
 * Injectable seam for the automatic, scheduled side of feed pulling.
 *
 * Where {@link FeedPullProducer} enqueues a single one-shot pull, the scheduler
 * maintains *one repeatable job per active Feed* — keyed by a stable id
 * (`feed:<id>`) so the schedule tracks Feed lifecycle exactly once. FeedsService
 * drives it (add/resume register, pause/delete remove) and a startup reconciler
 * makes the live schedule match the set of active Feeds.
 *
 * Production binds a BullMQ-backed implementation; unit/e2e harnesses bind a
 * recording double so no Redis is required.
 */
export interface FeedPullScheduler {
  /** Register (or refresh) the repeatable pull for a Feed, keyed `feed:<id>`. */
  schedule(feedId: string): Promise<void>;

  /** Remove a Feed's repeatable. A no-op if none exists (no orphan left behind). */
  unschedule(feedId: string): Promise<void>;

  /**
   * Make the live schedule match exactly `activeFeedIds`: register any missing,
   * remove any repeatable that no longer belongs to an active Feed. Called on
   * worker/API startup.
   */
  reconcile(activeFeedIds: string[]): Promise<void>;
}

export const FEED_PULL_SCHEDULER = Symbol('FeedPullScheduler');

/** Stable scheduler id for a Feed. Single source of truth for the key shape. */
export function feedSchedulerId(feedId: string): string {
  return `feed:${feedId}`;
}
