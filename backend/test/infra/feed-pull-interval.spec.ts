import {pullIntervalMs} from '../../src/infra/queues/bull-feed-pull-scheduler';

/**
 * The scheduled pull cadence is env-configurable. These cover the read itself
 * (no Redis): the configured value wins, and a sane default applies otherwise.
 */
describe('pullIntervalMs', () => {
  const original = process.env.FEED_PULL_INTERVAL_MS;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.FEED_PULL_INTERVAL_MS;
    } else {
      process.env.FEED_PULL_INTERVAL_MS = original;
    }
  });

  it('reads the interval from FEED_PULL_INTERVAL_MS', () => {
    process.env.FEED_PULL_INTERVAL_MS = '60000';
    expect(pullIntervalMs()).toBe(60000);
  });

  it('falls back to a default when the env var is unset or invalid', () => {
    delete process.env.FEED_PULL_INTERVAL_MS;
    expect(pullIntervalMs()).toBeGreaterThan(0);

    process.env.FEED_PULL_INTERVAL_MS = 'not-a-number';
    expect(pullIntervalMs()).toBeGreaterThan(0);
  });
});
