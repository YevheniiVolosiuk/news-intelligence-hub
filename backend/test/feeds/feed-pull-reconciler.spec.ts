import {FeedPullReconciler} from '../../src/modules/feeds/feed-pull-reconciler';
import {FeedsRepository} from '../../src/modules/feeds/feeds.repository';
import {RecordingFeedPullScheduler} from '../support/recording-feed-pull-scheduler';

/**
 * Startup reconciliation makes the live schedule match exactly the set of
 * active Feeds — no Redis, no Postgres: a fake repo supplies the active ids and
 * a recording scheduler captures the result.
 */
describe('FeedPullReconciler', () => {
  it('schedules exactly the active Feeds on application bootstrap', async () => {
    const activeIds = ['feed-a', 'feed-b', 'feed-c'];
    const repo = {
      listActiveIds: async () => activeIds,
    } as unknown as FeedsRepository;
    const scheduler = new RecordingFeedPullScheduler();
    // A stale repeatable from a previous run must not survive reconciliation.
    await scheduler.schedule('stale-feed');

    const reconciler = new FeedPullReconciler(repo, scheduler);
    await reconciler.onApplicationBootstrap();

    expect([...scheduler.scheduled].sort()).toEqual([...activeIds].sort());
    expect(scheduler.scheduled.has('stale-feed')).toBe(false);
  });
});
