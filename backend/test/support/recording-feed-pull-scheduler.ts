import {FeedPullScheduler} from '../../src/infra/queues/feed-pull-scheduler';

/**
 * Recording FeedPullScheduler double for unit/e2e tests. Keeps the harness
 * hermetic (no real Redis) the same way StubFeedPullProducer replaces the
 * queue. Tracks the live set of scheduled feed ids — exactly what a test needs
 * to assert register/remove without inspecting BullMQ internals.
 */
export class RecordingFeedPullScheduler implements FeedPullScheduler {
  /** Feed ids with a currently-registered repeatable. */
  readonly scheduled = new Set<string>();
  /** Ordered log of calls, for tests that care about the sequence. */
  readonly calls: Array<{
    op: 'schedule' | 'unschedule' | 'reconcile';
    arg: string | string[];
  }> = [];

  clear(): void {
    this.scheduled.clear();
    this.calls.length = 0;
  }

  async schedule(feedId: string): Promise<void> {
    this.scheduled.add(feedId);
    this.calls.push({op: 'schedule', arg: feedId});
  }

  async unschedule(feedId: string): Promise<void> {
    this.scheduled.delete(feedId);
    this.calls.push({op: 'unschedule', arg: feedId});
  }

  async reconcile(activeFeedIds: string[]): Promise<void> {
    this.scheduled.clear();
    for (const id of activeFeedIds) {
      this.scheduled.add(id);
    }
    this.calls.push({op: 'reconcile', arg: [...activeFeedIds]});
  }
}
