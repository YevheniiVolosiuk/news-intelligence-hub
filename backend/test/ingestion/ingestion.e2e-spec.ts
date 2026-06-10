import {Pool} from 'pg';
import {startE2EHarness, E2EHarness} from '../support/e2e-harness';
import {IngestionService} from '../../src/modules/ingestion/ingestion.service';

describe('IngestionService.pullFeed (integration)', () => {
  let harness: E2EHarness;
  let pool: Pool;

  beforeAll(async () => {
    harness = await startE2EHarness();
    pool = harness.pool;
  });

  afterAll(() => harness.close());

  /** Insert a user + active feed and return the feed row. */
  async function insertActiveFeed(
    url: string,
    normalisedUrl: string,
  ): Promise<{userId: string; feedId: string}> {
    const {
      rows: [user],
    } = await pool.query(
      `INSERT INTO users (email, password_hash, confirmed_at)
       VALUES ($1, $2, now()) RETURNING id`,
      [`test-${Date.now()}@example.com`, 'hash'],
    );
    const {
      rows: [feed],
    } = await pool.query(
      `INSERT INTO feeds (user_id, url, normalised_url, title, status)
       VALUES ($1, $2, $3, 'Test Feed', 'active') RETURNING id`,
      [user.id, url, normalisedUrl],
    );
    return {userId: user.id, feedId: feed.id};
  }

  // ── Tracer bullet: happy path ─────────────────────────────────

  it('pulls a feed and stores articles + source in the database', async () => {
    const url = 'https://example.com/feed.xml';
    const {feedId} = await insertActiveFeed(url, 'https://example.com/feed.xml');

    // Wire the stub fetcher to return RSS XML for this URL
    harness.feedFetcher.set(url, {
      ok: true,
      contentType: 'application/rss+xml',
      body: `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Tech Source</title>
    <link>https://example.com</link>
    <item>
      <title>First Post</title>
      <link>https://example.com/first-post</link>
      <description>A substantial article about technology trends and their long-term impact on society, covering artificial intelligence, quantum computing, and sustainable energy innovations that are reshaping industries worldwide in unprecedented ways.</description>
      <pubDate>Mon, 09 Jun 2025 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`,
    });

    const ingestionService = harness.app.get(IngestionService);
    const result = await ingestionService.pullFeed(feedId);

    expect(result).toEqual({
      pulled: 1,
      inserted: 1,
      filtered: 0,
      skipped: 0,
    });

    // Source was created
    const {rows: sources} = await pool.query(
      `SELECT * FROM sources WHERE normalised_host = 'example.com'`,
    );
    expect(sources).toHaveLength(1);
    expect(sources[0].title).toBe('Tech Source');

    // Article was created with correct fields
    const {rows: articles} = await pool.query(
      `SELECT * FROM articles WHERE feed_id = $1`,
      [feedId],
    );
    expect(articles).toHaveLength(1);
    const article = articles[0];
    expect(article.title).toBe('First Post');
    expect(article.url).toBe('https://example.com/first-post');
    expect(article.normalised_url).toBe('https://example.com/first-post');
    expect(article.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(article.processing_state).toBe('pending');
    expect(article.filtered_reason).toBeNull();
    expect(article.published_at).toBeTruthy();
    expect(article.source_id).toBe(sources[0].id);

    // Feed status stays active with last_pulled_at set
    const {rows: feeds} = await pool.query(
      `SELECT status, last_pulled_at, last_error FROM feeds WHERE id = $1`,
      [feedId],
    );
    expect(feeds[0].status).toBe('active');
    expect(feeds[0].last_pulled_at).toBeTruthy();
    expect(feeds[0].last_error).toBeNull();
  });

  // ── Idempotent pull ──────────────────────────────────────────────

  it('re-pulling the same feed skips already-seen articles', async () => {
    const url = 'https://idem.example.com/feed.xml';
    const {feedId} = await insertActiveFeed(url, 'https://idem.example.com/feed.xml');

    const rss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Idem Source</title>
    <link>https://idem.example.com</link>
    <item>
      <title>Stable Article</title>
      <link>https://idem.example.com/stable</link>
      <description>This is a long enough description to comfortably pass the pre-filter threshold and become a pending article for processing later on in the pipeline without being rejected as too short content for publication.</description>
    </item>
  </channel>
</rss>`;

    harness.feedFetcher.set(url, {ok: true, contentType: 'application/xml', body: rss});

    const ingestionService = harness.app.get(IngestionService);

    // First pull — inserts
    const first = await ingestionService.pullFeed(feedId);
    expect(first.inserted).toBe(1);
    expect(first.skipped).toBe(0);

    // Second pull — skips
    const second = await ingestionService.pullFeed(feedId);
    expect(second.pulled).toBe(1);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(1);

    // Still only one article row
    const {rows} = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM articles WHERE feed_id = $1`,
      [feedId],
    );
    expect(rows[0].cnt).toBe(1);
  });

  // ── Pre-filter routing ───────────────────────────────────────────

  it('routes short items to filtered state with a reason', async () => {
    const url = 'https://filter.example.com/feed.xml';
    const {feedId} = await insertActiveFeed(url, 'https://filter.example.com/feed.xml');

    const rss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Filter Source</title>
    <link>https://filter.example.com</link>
    <item>
      <title>Short Item</title>
      <link>https://filter.example.com/short</link>
      <description>Too short.</description>
    </item>
  </channel>
</rss>`;

    harness.feedFetcher.set(url, {ok: true, contentType: 'application/xml', body: rss});

    const ingestionService = harness.app.get(IngestionService);
    const result = await ingestionService.pullFeed(feedId);

    expect(result.filtered).toBe(1);
    expect(result.inserted).toBe(0);

    const {rows: articles} = await pool.query(
      `SELECT processing_state, filtered_reason FROM articles WHERE feed_id = $1`,
      [feedId],
    );
    expect(articles).toHaveLength(1);
    expect(articles[0].processing_state).toBe('filtered');
    expect(articles[0].filtered_reason).toBe('below-min-length');
  });

  // ── Cross-feed shared article + source ───────────────────────────

  it('same item via two feeds yields one shared article and one shared source', async () => {
    const rss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Shared Source</title>
    <link>https://shared.example.com</link>
    <item>
      <title>Shared Article</title>
      <link>https://shared.example.com/post</link>
      <description>A sufficiently long description of an article that should be shared across two different feeds owned by two different users of the system.</description>
    </item>
  </channel>
</rss>`;

    const url = 'https://shared.example.com/feed.xml';
    const feed1 = await insertActiveFeed(url, 'https://shared.example.com/feed.xml');
    const feed2 = await insertActiveFeed(url, 'https://shared.example.com/feed.xml');

    harness.feedFetcher.set(url, {ok: true, contentType: 'application/xml', body: rss});

    const ingestionService = harness.app.get(IngestionService);

    await ingestionService.pullFeed(feed1.feedId);
    await ingestionService.pullFeed(feed2.feedId);

    // One shared source
    const {rows: sources} = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM sources WHERE normalised_host = 'shared.example.com'`,
    );
    expect(sources[0].cnt).toBe(1);

    // One shared article (by normalised_url)
    const {rows: articles} = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM articles WHERE normalised_url = 'https://shared.example.com/post'`,
    );
    expect(articles[0].cnt).toBe(1);
  });

  // ── Fetch failure → error ────────────────────────────────────────

  it('sets feed to error + last_error on fetch failure and creates no articles', async () => {
    const url = 'https://down.example.com/feed.xml';
    const {feedId} = await insertActiveFeed(url, 'https://down.example.com/feed.xml');

    harness.feedFetcher.set(url, {ok: false, reason: 'unreachable'});

    const ingestionService = harness.app.get(IngestionService);
    const result = await ingestionService.pullFeed(feedId);

    expect(result).toEqual({pulled: 0, inserted: 0, filtered: 0, skipped: 0});

    const {rows: feeds} = await pool.query(
      `SELECT status, last_error, last_pulled_at FROM feeds WHERE id = $1`,
      [feedId],
    );
    expect(feeds[0].status).toBe('error');
    expect(feeds[0].last_error).toContain('fetch');
    expect(feeds[0].last_pulled_at).toBeNull();

    // No articles created
    const {rows: articles} = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM articles WHERE feed_id = $1`,
      [feedId],
    );
    expect(articles[0].cnt).toBe(0);
  });

  // ── Parse failure → error ────────────────────────────────────────

  it('sets feed to error on parse failure (non-feed HTML)', async () => {
    const url = 'https://html.example.com/feed.xml';
    const {feedId} = await insertActiveFeed(url, 'https://html.example.com/feed.xml');

    harness.feedFetcher.set(url, {
      ok: true,
      contentType: 'text/html',
      body: '<!DOCTYPE html><html><body>Hello</body></html>',
    });

    const ingestionService = harness.app.get(IngestionService);
    const result = await ingestionService.pullFeed(feedId);

    expect(result).toEqual({pulled: 0, inserted: 0, filtered: 0, skipped: 0});

    const {rows: feeds} = await pool.query(
      `SELECT status, last_error FROM feeds WHERE id = $1`,
      [feedId],
    );
    expect(feeds[0].status).toBe('error');
    expect(feeds[0].last_error).toContain('parse');
  });

  // ── Error recovery ───────────────────────────────────────────────

  it('recovers an error feed to active on next successful pull', async () => {
    const url = 'https://recover.example.com/feed.xml';
    const {feedId} = await insertActiveFeed(url, 'https://recover.example.com/feed.xml');

    // First pull — fails
    harness.feedFetcher.set(url, {ok: false, reason: 'unreachable'});
    const ingestionService = harness.app.get(IngestionService);
    await ingestionService.pullFeed(feedId);

    const {rows: afterError} = await pool.query(
      `SELECT status, last_error FROM feeds WHERE id = $1`,
      [feedId],
    );
    expect(afterError[0].status).toBe('error');

    // Second pull — succeeds
    harness.feedFetcher.set(url, {
      ok: true,
      contentType: 'application/xml',
      body: `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Recovery Source</title>
    <link>https://recover.example.com</link>
    <item>
      <title>Recovered Article</title>
      <link>https://recover.example.com/recovered</link>
      <description>A successful recovery pull with plenty of meaningful content to comfortably pass all pre-filter length checks and become a pending article ready for labelling by the LLM processing pipeline.</description>
    </item>
  </channel>
</rss>`,
    });

    const result = await ingestionService.pullFeed(feedId);
    expect(result.inserted).toBe(1);

    const {rows: feeds} = await pool.query(
      `SELECT status, last_pulled_at, last_error FROM feeds WHERE id = $1`,
      [feedId],
    );
    expect(feeds[0].status).toBe('active');
    expect(feeds[0].last_pulled_at).toBeTruthy();
    expect(feeds[0].last_error).toBeNull();
  });

  // ── Paused feed is no-op ─────────────────────────────────────────

  it('returns zeros when pulling a paused feed', async () => {
    const url = 'https://paused.example.com/feed.xml';
    const {userId, feedId} = await insertActiveFeed(url, 'https://paused.example.com/feed.xml');

    // Pause the feed
    await pool.query(
      `UPDATE feeds SET status = 'paused' WHERE id = $1 AND user_id = $2`,
      [feedId, userId],
    );

    harness.feedFetcher.set(url, {
      ok: true,
      contentType: 'application/xml',
      body: `<?xml version="1.0"?><rss version="2.0"><channel><title>X</title></channel></rss>`,
    });

    const ingestionService = harness.app.get(IngestionService);
    const result = await ingestionService.pullFeed(feedId);

    expect(result).toEqual({pulled: 0, inserted: 0, filtered: 0, skipped: 0});
  });
});
