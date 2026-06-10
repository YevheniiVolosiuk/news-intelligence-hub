import {
  MigrationHarness,
  startMigrationHarness,
} from '../support/migration-harness';

/**
 * Slice 3.1 is a data-layer-only slice (no runtime caller yet; IngestionService
 * in 3.4 is the first writer), so it is proven at the SQL boundary: the shared
 * `sources` + `articles` schema of ADR-0001 and the constraints the rest of
 * Slice 3 relies on (unique Source host, unique Article URL, detach-on-Feed-
 * delete, the four-state Processing State CHECK).
 */
describe('Articles + Sources schema (Slice 3.1)', () => {
  let harness: MigrationHarness;

  beforeAll(async () => {
    harness = await startMigrationHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  /** Inserts a Source and returns its id, for Articles that need a parent. */
  async function insertSource(host: string): Promise<string> {
    const res = await harness.pool.query<{id: string}>(
      'INSERT INTO sources (normalised_host) VALUES ($1) RETURNING id',
      [host],
    );
    return res.rows[0].id;
  }

  it('applies cleanly: sources, articles, and the new feeds columns exist', async () => {
    const tables = await harness.pool.query<{table_name: string}>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('sources', 'articles')
       ORDER BY table_name`,
    );
    expect(tables.rows.map(r => r.table_name)).toEqual(['articles', 'sources']);

    const feedsColumns = await harness.pool.query<{column_name: string}>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'feeds'
         AND column_name IN ('last_pulled_at', 'last_error')
       ORDER BY column_name`,
    );
    expect(feedsColumns.rows.map(r => r.column_name)).toEqual([
      'last_error',
      'last_pulled_at',
    ]);
  });

  it('rejects two Sources sharing a normalised host (one outlet, one row)', async () => {
    await harness.pool.query(
      "INSERT INTO sources (normalised_host) VALUES ('blog.example.com')",
    );

    await expect(
      harness.pool.query(
        "INSERT INTO sources (normalised_host) VALUES ('blog.example.com')",
      ),
    ).rejects.toMatchObject({code: '23505'});
  });

  it('rejects two Articles sharing a normalised URL (re-pulls insert-or-skip)', async () => {
    const sourceId = await insertSource('unique-url.example.com');
    await harness.pool.query(
      `INSERT INTO articles (source_id, url, normalised_url)
       VALUES ($1, 'https://x.example.com/a', 'https://x.example.com/a')`,
      [sourceId],
    );

    await expect(
      harness.pool.query(
        `INSERT INTO articles (source_id, url, normalised_url)
         VALUES ($1, 'https://x.example.com/a?utm=1', 'https://x.example.com/a')`,
        [sourceId],
      ),
    ).rejects.toMatchObject({code: '23505'});
  });

  it('detaches Articles when their Feed is deleted (SET NULL, never cascade)', async () => {
    const sourceId = await insertSource('detach.example.com');
    const user = await harness.pool.query<{id: string}>(
      `INSERT INTO users (email, password_hash)
       VALUES ('detach@example.com', 'x') RETURNING id`,
    );
    const feed = await harness.pool.query<{id: string}>(
      `INSERT INTO feeds (user_id, url, normalised_url)
       VALUES ($1, 'https://detach.example.com/feed', 'https://detach.example.com/feed')
       RETURNING id`,
      [user.rows[0].id],
    );
    const article = await harness.pool.query<{id: string}>(
      `INSERT INTO articles (source_id, feed_id, url, normalised_url)
       VALUES ($1, $2, 'https://detach.example.com/a', 'https://detach.example.com/a')
       RETURNING id`,
      [sourceId, feed.rows[0].id],
    );

    await harness.pool.query('DELETE FROM feeds WHERE id = $1', [
      feed.rows[0].id,
    ]);

    const surviving = await harness.pool.query<{feed_id: string | null}>(
      'SELECT feed_id FROM articles WHERE id = $1',
      [article.rows[0].id],
    );
    expect(surviving.rows).toHaveLength(1);
    expect(surviving.rows[0].feed_id).toBeNull();
  });

  it('constrains processing_state to the four-state vocabulary', async () => {
    const sourceId = await insertSource('states.example.com');

    await expect(
      harness.pool.query(
        `INSERT INTO articles (source_id, url, normalised_url, processing_state)
         VALUES ($1, 'https://states.example.com/bad', 'https://states.example.com/bad', 'archived')`,
        [sourceId],
      ),
    ).rejects.toMatchObject({code: '23514'});

    for (const state of ['pending', 'filtered', 'processed', 'awaiting']) {
      await harness.pool.query(
        `INSERT INTO articles (source_id, url, normalised_url, processing_state)
         VALUES ($1, $2, $2, $3)`,
        [sourceId, `https://states.example.com/${state}`, state],
      );
    }
  });
});
