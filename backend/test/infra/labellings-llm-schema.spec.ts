import {
  MigrationHarness,
  startMigrationHarness,
} from '../support/migration-harness';

/**
 * Slice 4.1 is the data spine for Labelling, with no runtime caller yet (the
 * label worker arrives in a later slice), so it is proven at the SQL boundary:
 * the per-User `labellings` table of ADR-0001 with its idempotent upsert key,
 * the `llm_cache` / `llm_telemetry` accounting tables, and the extension of the
 * Processing State CHECK to admit the `failed` terminal (CONTEXT.md).
 */
describe('Labelling + LLM schema (Slice 4.1)', () => {
  let harness: MigrationHarness;

  beforeAll(async () => {
    harness = await startMigrationHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  /** Inserts a User and returns its id, for rows that need an owner. */
  async function insertUser(email: string): Promise<string> {
    const res = await harness.pool.query<{id: string}>(
      "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
      [email],
    );
    return res.rows[0].id;
  }

  /** Inserts a Source + Article and returns the Article id. */
  async function insertArticle(host: string): Promise<string> {
    const source = await harness.pool.query<{id: string}>(
      'INSERT INTO sources (normalised_host) VALUES ($1) RETURNING id',
      [host],
    );
    const url = `https://${host}/a`;
    const article = await harness.pool.query<{id: string}>(
      `INSERT INTO articles (source_id, url, normalised_url)
       VALUES ($1, $2, $2) RETURNING id`,
      [source.rows[0].id, url],
    );
    return article.rows[0].id;
  }

  it('rejects two Labellings for the same (user, article) (the idempotent upsert key)', async () => {
    const userId = await insertUser('label@example.com');
    const articleId = await insertArticle('label.example.com');

    await harness.pool.query(
      `INSERT INTO labellings (user_id, article_id, summary, importance, model, prompt_version)
       VALUES ($1, $2, 'A summary', 'normal', 'gpt', 'v1')`,
      [userId, articleId],
    );

    await expect(
      harness.pool.query(
        `INSERT INTO labellings (user_id, article_id, summary, importance, model, prompt_version)
         VALUES ($1, $2, 'A different summary', 'important', 'gpt', 'v1')`,
        [userId, articleId],
      ),
    ).rejects.toMatchObject({code: '23505'});
  });

  it('admits the failed Processing State while still rejecting an unknown value', async () => {
    const sourceId = (
      await harness.pool.query<{id: string}>(
        'INSERT INTO sources (normalised_host) VALUES ($1) RETURNING id',
        ['failed-state.example.com'],
      )
    ).rows[0].id;

    await harness.pool.query(
      `INSERT INTO articles (source_id, url, normalised_url, processing_state)
       VALUES ($1, 'https://failed-state.example.com/f', 'https://failed-state.example.com/f', 'failed')`,
      [sourceId],
    );

    await expect(
      harness.pool.query(
        `INSERT INTO articles (source_id, url, normalised_url, processing_state)
         VALUES ($1, 'https://failed-state.example.com/bad', 'https://failed-state.example.com/bad', 'archived')`,
        [sourceId],
      ),
    ).rejects.toMatchObject({code: '23514'});
  });

  it('stores an llm_cache entry keyed by cache_key and rejects a duplicate key', async () => {
    await harness.pool.query(
      `INSERT INTO llm_cache
         (cache_key, content_hash, model, prompt_version, result_json,
          prompt_tokens, completion_tokens, total_tokens)
       VALUES ('k1', 'hash1', 'gpt', 'v1', '{"summary":"x"}', 10, 5, 15)`,
    );

    const row = await harness.pool.query<{
      total_tokens: number;
      result_json: {summary: string};
      created_at: Date;
    }>(
      "SELECT total_tokens, result_json, created_at FROM llm_cache WHERE cache_key = 'k1'",
    );
    expect(row.rows[0].total_tokens).toBe(15);
    expect(row.rows[0].result_json).toEqual({summary: 'x'});
    expect(row.rows[0].created_at).toBeInstanceOf(Date);

    await expect(
      harness.pool.query(
        `INSERT INTO llm_cache
           (cache_key, content_hash, model, prompt_version, result_json,
            prompt_tokens, completion_tokens, total_tokens)
         VALUES ('k1', 'hash2', 'gpt', 'v1', '{"summary":"y"}', 1, 1, 2)`,
      ),
    ).rejects.toMatchObject({code: '23505'});
  });

  it('keeps an llm_telemetry row when the User and Article it described are deleted (SET NULL)', async () => {
    const userId = await insertUser('telemetry@example.com');
    const articleId = await insertArticle('telemetry.example.com');

    const inserted = await harness.pool.query<{id: string}>(
      `INSERT INTO llm_telemetry
         (operation, provider, model, prompt_tokens, completion_tokens,
          total_tokens, cache_hit, outcome, article_id, user_id, latency_ms)
       VALUES ('processing', 'openai', 'gpt', 12, 8, 20, false, 'success', $1, $2, 350)
       RETURNING id`,
      [articleId, userId],
    );
    const telemetryId = inserted.rows[0].id;

    await harness.pool.query('DELETE FROM labellings WHERE user_id = $1', [
      userId,
    ]);
    await harness.pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await harness.pool.query('DELETE FROM articles WHERE id = $1', [articleId]);

    const surviving = await harness.pool.query<{
      user_id: string | null;
      article_id: string | null;
      total_tokens: number;
    }>(
      'SELECT user_id, article_id, total_tokens FROM llm_telemetry WHERE id = $1',
      [telemetryId],
    );
    expect(surviving.rows).toHaveLength(1);
    expect(surviving.rows[0].user_id).toBeNull();
    expect(surviving.rows[0].article_id).toBeNull();
    expect(surviving.rows[0].total_tokens).toBe(20);
  });
});
