import {Pool} from 'pg';
import {Test} from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {FEED_FETCHER} from '../../src/modules/ingestion/feed-fetcher';
import {FEED_PULL_PRODUCER} from '../../src/infra/queues/feed-pull-producer';
import {CLOCK} from '../../src/common/utils/clock';
import {IngestionService} from '../../src/modules/ingestion/ingestion.service';
import {StubFeedFetcher} from '../support/stub-feed-fetcher';
import {StubFeedPullProducer} from '../support/stub-feed-pull-producer';
import {runMigrations} from '../../src/infra/database/migrate';
import {WorkerModule} from '../../src/worker.module';

describe('Worker (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let feedFetcher: StubFeedFetcher;
  let moduleRef: import('@nestjs/testing').TestingModule;
  let ingestion: IngestionService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start();
    const databaseUrl = container.getConnectionUri();
    process.env.DATABASE_URL = databaseUrl;
    await runMigrations(databaseUrl);

    feedFetcher = new StubFeedFetcher();

    moduleRef = await Test.createTestingModule({
      imports: [WorkerModule],
    })
      .overrideProvider(FEED_FETCHER)
      .useValue(feedFetcher)
      .overrideProvider(FEED_PULL_PRODUCER)
      .useValue(new StubFeedPullProducer())
      .overrideProvider(CLOCK)
      .useFactory({factory: () => () => new Date()})
      .compile();

    ingestion = moduleRef.get(IngestionService);
    pool = new Pool({connectionString: databaseUrl});
  });

  afterAll(async () => {
    await moduleRef?.close().catch(() => undefined);
    await pool?.end().catch(() => undefined);
    await container?.stop().catch(() => undefined);
  });

  // ── Tracer bullet: Worker boots and resolves IngestionService ──────

  it('boots a NestJS context and resolves IngestionService', () => {
    expect(ingestion).toBeDefined();
    expect(ingestion).toBeInstanceOf(IngestionService);
  });

  // ── Worker drains a real pull end-to-end ────────────────────────────

  /** Insert a user + active feed and return the feed id. */
  async function insertActiveFeed(url: string): Promise<string> {
    const {
      rows: [user],
    } = await pool.query(
      `INSERT INTO users (email, password_hash, confirmed_at)
       VALUES ($1, $2, now()) RETURNING id`,
      [`worker-${Date.now()}@example.com`, 'hash'],
    );
    const {
      rows: [feed],
    } = await pool.query(
      `INSERT INTO feeds (user_id, url, normalised_url, title, status)
       VALUES ($1, $2, $3, 'Worker Test Feed', 'active') RETURNING id`,
      [user.id, url, url],
    );
    return feed.id;
  }

  it('pulls a feed and stores articles via the worker context', async () => {
    const url = 'https://worker.example.com/feed.xml';
    const feedId = await insertActiveFeed(url);

    feedFetcher.set(url, {
      ok: true,
      contentType: 'application/rss+xml',
      body: `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Worker Source</title>
    <link>https://worker.example.com</link>
    <item>
      <title>Worker Article</title>
      <link>https://worker.example.com/post-1</link>
      <description>A substantial article about worker-driven feed ingestion that is long enough to pass the pre-filter threshold and become a pending article ready for downstream processing in the intelligence pipeline.</description>
    </item>
  </channel>
</rss>`,
    });

    // This is exactly what the BullMQ processor will do:
    //   job => ingestion.pullFeed(job.data.feedId)
    const summary = await ingestion.pullFeed(feedId);

    expect(summary).toEqual({
      pulled: 1,
      inserted: 1,
      filtered: 0,
      skipped: 0,
    });

    // Article landed in the DB
    const {rows: articles} = await pool.query(
      `SELECT * FROM articles WHERE feed_id = $1`,
      [feedId],
    );
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('Worker Article');
    expect(articles[0].processing_state).toBe('pending');

    // Source was created
    const {rows: sources} = await pool.query(
      `SELECT * FROM sources WHERE normalised_host = 'worker.example.com'`,
    );
    expect(sources).toHaveLength(1);
    expect(sources[0].title).toBe('Worker Source');

    // Feed stays active with last_pulled_at set
    const {rows: feeds} = await pool.query(
      `SELECT status, last_pulled_at FROM feeds WHERE id = $1`,
      [feedId],
    );
    expect(feeds[0].status).toBe('active');
    expect(feeds[0].last_pulled_at).toBeTruthy();
  });

  it('handles a fetch failure gracefully through the worker context', async () => {
    const url = 'https://down-worker.example.com/feed.xml';
    const feedId = await insertActiveFeed(url);

    feedFetcher.set(url, {ok: false, reason: 'timeout'});

    const summary = await ingestion.pullFeed(feedId);

    expect(summary).toEqual({pulled: 0, inserted: 0, filtered: 0, skipped: 0});

    const {rows: feeds} = await pool.query(
      `SELECT status, last_error FROM feeds WHERE id = $1`,
      [feedId],
    );
    expect(feeds[0].status).toBe('error');
    expect(feeds[0].last_error).toContain('fetch');
  });
});
