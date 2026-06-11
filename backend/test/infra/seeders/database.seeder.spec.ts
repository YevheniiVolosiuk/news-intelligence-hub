import {Pool} from 'pg';
import {
  startMigrationHarness,
  MigrationHarness,
} from '../../support/migration-harness';
import {
  seedDemoData,
  DemoSeedResult,
} from '../../../src/infra/database/seeders/database.seeder';

describe('seedDemoData', () => {
  let harness: MigrationHarness;
  let pool: Pool;

  beforeAll(async () => {
    harness = await startMigrationHarness();
    pool = harness.pool;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('creates a confirmed demo user', async () => {
    const result: DemoSeedResult = await seedDemoData(pool);

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe('demo@example.com');

    const {rows} = await pool.query(
      'SELECT id, email, confirmed_at FROM users WHERE email = $1',
      ['demo@example.com'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(result.user.id);
    expect(rows[0].confirmed_at).not.toBeNull();
  });

  it('creates at least 3 feeds for the demo user', async () => {
    const result: DemoSeedResult = await seedDemoData(pool);

    expect(result.feeds.length).toBeGreaterThanOrEqual(3);

    const {rows} = await pool.query(
      'SELECT id, url, title FROM feeds WHERE user_id = $1',
      [result.user.id],
    );
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const feed of result.feeds) {
      expect(rows.some(r => r.id === feed.id)).toBe(true);
    }
  });

  it('creates at least 2 sources with different hosts', async () => {
    const result: DemoSeedResult = await seedDemoData(pool);

    expect(result.sources.length).toBeGreaterThanOrEqual(2);

    const hosts = result.sources.map(s => s.normalisedHost);
    const uniqueHosts = new Set(hosts);
    expect(uniqueHosts.size).toBeGreaterThanOrEqual(2);

    const {rows} = await pool.query('SELECT id, normalised_host FROM sources');
    for (const source of result.sources) {
      expect(rows.some(r => r.id === source.id)).toBe(true);
    }
  });

  it('creates articles with both pending and filtered states across multiple sources', async () => {
    const result: DemoSeedResult = await seedDemoData(pool);

    expect(result.articles.length).toBeGreaterThanOrEqual(4);

    const states = result.articles.map(a => a.processingState);
    expect(states).toContain('pending');
    expect(states).toContain('filtered');

    // Verify in DB — articles must reference the seeded sources
    const {rows} = await pool.query(
      'SELECT id, source_id, processing_state, filtered_reason FROM articles',
    );
    expect(rows.length).toBeGreaterThanOrEqual(4);

    const seededSourceIds = new Set(result.sources.map(s => s.id));
    const articlesOnSeededSources = rows.filter((r: {source_id: string}) =>
      seededSourceIds.has(r.source_id),
    );
    expect(articlesOnSeededSources.length).toBeGreaterThanOrEqual(4);

    const dbStates = articlesOnSeededSources.map(
      (r: {processing_state: string}) => r.processing_state,
    );
    expect(dbStates).toContain('pending');
    expect(dbStates).toContain('filtered');
  });

  it('is safe to re-run without errors or duplicate rows', async () => {
    const first = await seedDemoData(pool);
    const second = await seedDemoData(pool);

    // Same user
    expect(second.user.id).toBe(first.user.id);

    // Same feeds — no duplicates
    const {rows: feedRows} = await pool.query(
      'SELECT id FROM feeds WHERE user_id = $1',
      [first.user.id],
    );
    expect(feedRows).toHaveLength(first.feeds.length);

    // Same sources — no duplicates
    const {rows: sourceRows} = await pool.query('SELECT id FROM sources');
    expect(sourceRows).toHaveLength(first.sources.length);

    // Same articles — no duplicates
    const {rows: articleRows} = await pool.query(
      'SELECT id FROM articles WHERE feed_id IS NOT NULL',
    );
    expect(articleRows).toHaveLength(first.articles.length);
  });
});
