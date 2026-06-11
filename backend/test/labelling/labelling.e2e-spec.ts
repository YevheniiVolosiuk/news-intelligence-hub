import {Pool} from 'pg';
import {Test} from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {FEED_FETCHER} from '../../src/modules/ingestion/feed-fetcher';
import {FEED_PULL_PRODUCER} from '../../src/infra/queues/feed-pull-producer';
import {ARTICLE_LABEL_PRODUCER} from '../../src/infra/queues/article-label-producer';
import {LLM_SERVICE} from '../../src/infra/llm/llm-service';
import {CLOCK} from '../../src/common/utils/clock';
import {LabellingService} from '../../src/modules/labelling/labelling.service';
import {StubFeedFetcher} from '../support/stub-feed-fetcher';
import {StubFeedPullProducer} from '../support/stub-feed-pull-producer';
import {StubArticleLabelProducer} from '../support/stub-article-label-producer';
import {StubLlmService} from '../support/stub-llm-service';
import {runMigrations} from '../../src/infra/database/migrate';
import {WorkerModule} from '../../src/worker.module';

/**
 * The labelling flow proven through the worker context, the analogue of
 * `worker.e2e-spec`: a `pending` Article is handed to `LabellingService` and the
 * LLM is reached only through the injected `StubLlmService` double — no real
 * provider is contacted. This is exactly what the BullMQ processor will do:
 *   job => labelling.labelArticle(job.data.articleId)
 */
describe('LabellingService.labelArticle (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let llm: StubLlmService;
  let moduleRef: import('@nestjs/testing').TestingModule;
  let labelling: LabellingService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start();
    const databaseUrl = container.getConnectionUri();
    process.env.DATABASE_URL = databaseUrl;
    await runMigrations(databaseUrl);

    llm = new StubLlmService();

    moduleRef = await Test.createTestingModule({
      imports: [WorkerModule],
    })
      .overrideProvider(FEED_FETCHER)
      .useValue(new StubFeedFetcher())
      .overrideProvider(FEED_PULL_PRODUCER)
      .useValue(new StubFeedPullProducer())
      .overrideProvider(ARTICLE_LABEL_PRODUCER)
      .useValue(new StubArticleLabelProducer())
      .overrideProvider(LLM_SERVICE)
      .useValue(llm)
      .overrideProvider(CLOCK)
      .useFactory({factory: () => () => new Date()})
      .compile();

    labelling = moduleRef.get(LabellingService);
    pool = new Pool({connectionString: databaseUrl});
  });

  afterAll(async () => {
    await moduleRef?.close().catch(() => undefined);
    await pool?.end().catch(() => undefined);
    await container?.stop().catch(() => undefined);
  });

  /** Insert a User + active Feed + a pending Article; return their ids. */
  async function insertPendingArticle(content: string): Promise<{
    userId: string;
    articleId: string;
  }> {
    const {
      rows: [user],
    } = await pool.query(
      `INSERT INTO users (email, password_hash, confirmed_at)
       VALUES ($1, 'hash', now()) RETURNING id`,
      [`label-${Date.now()}-${Math.random()}@example.com`],
    );
    const {
      rows: [feed],
    } = await pool.query(
      `INSERT INTO feeds (user_id, url, normalised_url, title, status)
       VALUES ($1, $2, $2, 'Label Feed', 'active') RETURNING id`,
      [user.id, `https://label-${Math.random()}.example.com/feed.xml`],
    );
    const {
      rows: [source],
    } = await pool.query(
      'INSERT INTO sources (normalised_host) VALUES ($1) RETURNING id',
      [`label-${Math.random()}.example.com`],
    );
    const url = `https://label-${Math.random()}.example.com/a`;
    const {
      rows: [article],
    } = await pool.query(
      `INSERT INTO articles
         (source_id, feed_id, url, normalised_url, title, content, processing_state)
       VALUES ($1, $2, $3, $3, 'An Article', $4, 'pending') RETURNING id`,
      [source.id, feed.id, url, content],
    );
    return {userId: user.id, articleId: article.id};
  }

  it('writes a Labelling for the Feed owner and marks the Article processed', async () => {
    const content = 'The full article body the LLM analyses.';
    const {userId, articleId} = await insertPendingArticle(content);

    llm.set(content, {
      summary: 'A concise summary.',
      importance: 'important',
      entities: [{name: 'Acme', type: 'company'}],
    });

    await labelling.labelArticle(articleId);

    const {rows: labellings} = await pool.query(
      `SELECT user_id, article_id, summary, importance, entities, prompt_version
         FROM labellings WHERE article_id = $1`,
      [articleId],
    );
    expect(labellings).toHaveLength(1);
    expect(labellings[0].user_id).toBe(userId);
    expect(labellings[0].summary).toBe('A concise summary.');
    expect(labellings[0].importance).toBe('important');
    expect(labellings[0].entities).toEqual([{name: 'Acme', type: 'company'}]);
    expect(labellings[0].prompt_version).toBe('v1');

    const {rows: articles} = await pool.query(
      'SELECT processing_state FROM articles WHERE id = $1',
      [articleId],
    );
    expect(articles[0].processing_state).toBe('processed');
  });

  it('re-running the same job upserts rather than stacking a second Labelling', async () => {
    const content = 'Body analysed twice by a re-run of the same job.';
    const {articleId} = await insertPendingArticle(content);

    llm.set(content, {
      summary: 'First pass.',
      importance: 'normal',
      entities: [],
    });
    await labelling.labelArticle(articleId);

    // Same job runs again — e.g. a BullMQ retry. The second pass overwrites.
    llm.set(content, {
      summary: 'Second pass.',
      importance: 'important',
      entities: [],
    });
    await labelling.labelArticle(articleId);

    const {rows} = await pool.query(
      'SELECT summary, importance FROM labellings WHERE article_id = $1',
      [articleId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toBe('Second pass.');
    expect(rows[0].importance).toBe('important');
  });

  it('never labels a pre-filtered Article', async () => {
    const content = 'A filtered article that must never reach the LLM.';
    const {articleId} = await insertPendingArticle(content);
    await pool.query(
      "UPDATE articles SET processing_state = 'filtered' WHERE id = $1",
      [articleId],
    );

    const before = llm.callCount;
    await labelling.labelArticle(articleId);

    // The LLM was never reached and no Labelling was written.
    expect(llm.callCount).toBe(before);
    const {rows} = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM labellings WHERE article_id = $1',
      [articleId],
    );
    expect(rows[0].cnt).toBe(0);

    // The Article stays filtered — it is not pushed to processed.
    const {rows: articles} = await pool.query(
      'SELECT processing_state FROM articles WHERE id = $1',
      [articleId],
    );
    expect(articles[0].processing_state).toBe('filtered');
  });
});
