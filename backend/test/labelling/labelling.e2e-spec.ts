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
import {LlmValidationError} from '../../src/infra/llm/article-analysis';
import {computeContentHash} from '../../src/common/utils/content-hash';
import {llmCacheKey} from '../../src/infra/llm/llm-cache-key';
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
  let labelProducer: StubArticleLabelProducer;
  let moduleRef: import('@nestjs/testing').TestingModule;
  let labelling: LabellingService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start();
    const databaseUrl = container.getConnectionUri();
    process.env.DATABASE_URL = databaseUrl;
    await runMigrations(databaseUrl);

    llm = new StubLlmService();
    labelProducer = new StubArticleLabelProducer();

    moduleRef = await Test.createTestingModule({
      imports: [WorkerModule],
    })
      .overrideProvider(FEED_FETCHER)
      .useValue(new StubFeedFetcher())
      .overrideProvider(FEED_PULL_PRODUCER)
      .useValue(new StubFeedPullProducer())
      .overrideProvider(ARTICLE_LABEL_PRODUCER)
      .useValue(labelProducer)
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
         (source_id, feed_id, url, normalised_url, content_hash,
          title, content, processing_state)
       VALUES ($1, $2, $3, $3, $4, 'An Article', $5, 'pending') RETURNING id`,
      [
        source.id,
        feed.id,
        url,
        computeContentHash('An Article', content),
        content,
      ],
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
    const before = llm.callCount;
    await labelling.labelArticle(articleId);

    // Same job runs again — e.g. a BullMQ retry. Even though the provider would
    // now answer differently, the content is unchanged, so the re-run is a cache
    // hit: the stored analysis is reused and the provider is not called again.
    llm.set(content, {
      summary: 'Second pass.',
      importance: 'important',
      entities: [],
    });
    await labelling.labelArticle(articleId);

    expect(llm.callCount).toBe(before + 1);

    // The upsert leaves exactly one row, holding the first (cached) analysis.
    const {rows} = await pool.query(
      'SELECT summary, importance FROM labellings WHERE article_id = $1',
      [articleId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toBe('First pass.');
    expect(rows[0].importance).toBe('normal');
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

  it('a cache miss calls the provider once and writes an llm_cache row', async () => {
    const content = 'Distinct content that has never been analysed before.';
    const {articleId} = await insertPendingArticle(content);
    const result = {
      summary: 'Cached summary.',
      importance: 'normal' as const,
      entities: [{name: 'Globex', type: 'company' as const}],
    };
    llm.set(content, result);

    const before = llm.callCount;
    await labelling.labelArticle(articleId);

    // The provider was reached exactly once for the cold content.
    expect(llm.callCount).toBe(before + 1);

    // The row is keyed by sha256(content_hash + model + prompt_version) and
    // stores the validated analysis verbatim.
    const cacheKey = llmCacheKey(
      computeContentHash('An Article', content),
      'stub-model',
      'v1',
    );
    const {rows} = await pool.query(
      `SELECT content_hash, model, prompt_version, result_json
         FROM llm_cache WHERE cache_key = $1`,
      [cacheKey],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].model).toBe('stub-model');
    expect(rows[0].prompt_version).toBe('v1');
    expect(rows[0].result_json).toEqual(result);
  });

  it('reuses the cached result for a second User/Article without a provider call', async () => {
    const content = 'Identical body two Feeds both happen to carry.';
    const result = {
      summary: 'Shared analysis.',
      importance: 'important' as const,
      entities: [{name: 'Initech', type: 'company' as const}],
    };

    // First User/Article: cold miss, provider analyses and the row is written.
    const first = await insertPendingArticle(content);
    llm.set(content, result);
    await labelling.labelArticle(first.articleId);

    // Second User/Article with the *same content* — a different Feed owner.
    const second = await insertPendingArticle(content);
    const callsAfterFirst = llm.callCount;
    await labelling.labelArticle(second.articleId);

    // The cache served the second labelling: the provider was not reached again.
    expect(llm.callCount).toBe(callsAfterFirst);

    // The reused result produces the same Labelling fields for the second pair.
    const {rows} = await pool.query(
      `SELECT user_id, summary, importance, entities
         FROM labellings WHERE article_id = $1`,
      [second.articleId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(second.userId);
    expect(rows[0].summary).toBe('Shared analysis.');
    expect(rows[0].importance).toBe('important');
    expect(rows[0].entities).toEqual([{name: 'Initech', type: 'company'}]);
  });

  it('records one telemetry row for a real provider call (cache miss)', async () => {
    const content = 'Cold content whose provider call must be accounted for.';
    const {userId, articleId} = await insertPendingArticle(content);
    llm.set(
      content,
      {summary: 'Counted.', importance: 'normal', entities: []},
      {promptTokens: 120, completionTokens: 30, totalTokens: 150},
    );

    await labelling.labelArticle(articleId);

    const {rows} = await pool.query(
      `SELECT operation, provider, model, prompt_tokens, completion_tokens,
              total_tokens, cache_hit, outcome, article_id, user_id, latency_ms
         FROM llm_telemetry WHERE article_id = $1`,
      [articleId],
    );
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.operation).toBe('processing');
    expect(row.provider).toBe('stub');
    expect(row.model).toBe('stub-model');
    expect(row.cache_hit).toBe(false);
    expect(row.prompt_tokens).toBe(120);
    expect(row.completion_tokens).toBe(30);
    expect(row.total_tokens).toBe(150);
    expect(row.outcome).toBe('ok');
    expect(row.user_id).toBe(userId);
    expect(Number.isInteger(row.latency_ms)).toBe(true);
    expect(row.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('records a zero-token cache_hit row when the cache serves a labelling', async () => {
    const content = 'Shared body whose second labelling is a cache hit.';
    const result = {
      summary: 'Served from cache.',
      importance: 'normal' as const,
      entities: [],
    };

    // First Article: cold miss warms the cache (its own call-row is asserted
    // elsewhere). Second Article with the same content is the hit under test.
    const first = await insertPendingArticle(content);
    llm.set(content, result, {
      promptTokens: 80,
      completionTokens: 20,
      totalTokens: 100,
    });
    await labelling.labelArticle(first.articleId);

    const second = await insertPendingArticle(content);
    await labelling.labelArticle(second.articleId);

    const {rows} = await pool.query(
      `SELECT cache_hit, prompt_tokens, completion_tokens, total_tokens,
              operation, article_id, user_id
         FROM llm_telemetry WHERE article_id = $1`,
      [second.articleId],
    );
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.cache_hit).toBe(true);
    expect(row.prompt_tokens).toBe(0);
    expect(row.completion_tokens).toBe(0);
    expect(row.total_tokens).toBe(0);
    expect(row.operation).toBe('processing');
    expect(row.article_id).toBe(second.articleId);
    expect(row.user_id).toBe(second.userId);
  });

  it('makes calls / spend / calls-saved computable across a call-row and a hit-row', async () => {
    const content = 'One body, two labellings: one real call and one hit.';
    const result = {
      summary: 'Accounted once, saved once.',
      importance: 'important' as const,
      entities: [{name: 'Hooli', type: 'company' as const}],
    };
    llm.set(content, result, {
      promptTokens: 200,
      completionTokens: 50,
      totalTokens: 250,
    });

    // Two distinct Articles carrying identical content: the first is a cold
    // miss (a real provider call), the second a cache hit.
    const first = await insertPendingArticle(content);
    await labelling.labelArticle(first.articleId);
    const second = await insertPendingArticle(content);
    await labelling.labelArticle(second.articleId);

    // The two outcomes are two ledger rows attributable to this content.
    const {rows} = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE NOT cache_hit)::int       AS real_calls,
         COALESCE(SUM(total_tokens), 0)::int              AS spend,
         COUNT(*) FILTER (WHERE cache_hit)::int           AS calls_saved
       FROM llm_telemetry WHERE article_id = ANY($1)`,
      [[first.articleId, second.articleId]],
    );
    expect(rows[0].real_calls).toBe(1);
    expect(rows[0].spend).toBe(250);
    expect(rows[0].calls_saved).toBe(1);
  });

  it('writes no cache row when the provider call fails', async () => {
    const content = 'Body whose analysis fails and must not be memoised.';
    const {articleId} = await insertPendingArticle(content);

    llm.failWith(new Error('provider outage'));
    await expect(labelling.labelArticle(articleId)).rejects.toThrow(
      'provider outage',
    );
    llm.failWith(undefined); // clear the failure so later tests are unaffected

    // A bad outcome is never memoised — the next labelling of this content must
    // be a fresh miss, not a poisoned hit.
    const cacheKey = llmCacheKey(
      computeContentHash('An Article', content),
      'stub-model',
      'v1',
    );
    const {rows} = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM llm_cache WHERE cache_key = $1',
      [cacheKey],
    );
    expect(rows[0].cnt).toBe(0);
  });

  it('drives the Article to awaiting with the error recorded when an outage is exhausted', async () => {
    const content = 'Body whose provider stays down through the final attempt.';
    const {articleId} = await insertPendingArticle(content);

    // A provider outage (timeout / 5xx / rate-limit) on the *final* attempt:
    // retries are spent, so the Article defers to `awaiting` rather than failing.
    llm.failWith(new Error('provider timeout'));
    await labelling.labelArticle(articleId, {finalAttempt: true});
    llm.failWith(undefined);

    const {rows: articles} = await pool.query(
      'SELECT processing_state, processing_error FROM articles WHERE id = $1',
      [articleId],
    );
    expect(articles[0].processing_state).toBe('awaiting');
    expect(articles[0].processing_error).toContain('provider timeout');

    // A deferred Article writes neither a Labelling nor a cache row — the outage
    // produced nothing trustworthy to persist.
    const {rows: labellings} = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM labellings WHERE article_id = $1',
      [articleId],
    );
    expect(labellings[0].cnt).toBe(0);

    const cacheKey = llmCacheKey(
      computeContentHash('An Article', content),
      'stub-model',
      'v1',
    );
    const {rows: cache} = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM llm_cache WHERE cache_key = $1',
      [cacheKey],
    );
    expect(cache[0].cnt).toBe(0);
  });

  it('re-throws an outage while retries remain, leaving the Article pending', async () => {
    const content = 'Body whose provider blips on a non-final attempt.';
    const {articleId} = await insertPendingArticle(content);

    // Not the final attempt: the error must propagate so BullMQ retries with
    // backoff. The Article is NOT deferred yet — it stays pending for the retry.
    llm.failWith(new Error('provider 503'));
    await expect(
      labelling.labelArticle(articleId, {finalAttempt: false}),
    ).rejects.toThrow('provider 503');
    llm.failWith(undefined);

    const {rows} = await pool.query(
      'SELECT processing_state, processing_error FROM articles WHERE id = $1',
      [articleId],
    );
    expect(rows[0].processing_state).toBe('pending');
    expect(rows[0].processing_error).toBeNull();
  });

  it('fast-fails a validation-failing response to failed without retrying', async () => {
    const content = 'Body whose provider returns an un-parseable shape.';
    const {articleId} = await insertPendingArticle(content);

    // A response that fails the zod schema is non-retryable: it signals a
    // prompt/model fix, so even with retries nominally remaining the Article
    // goes straight to `failed` (no rethrow, no retry loop) and is flagged.
    llm.failWith(new LlmValidationError('importance: invalid enum value'));
    await labelling.labelArticle(articleId, {finalAttempt: false});
    llm.failWith(undefined);

    const {rows: articles} = await pool.query(
      'SELECT processing_state, processing_error FROM articles WHERE id = $1',
      [articleId],
    );
    expect(articles[0].processing_state).toBe('failed');
    expect(articles[0].processing_error).toContain('invalid enum value');

    // Nothing trustworthy was produced: no Labelling, no cache row.
    const {rows: labellings} = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM labellings WHERE article_id = $1',
      [articleId],
    );
    expect(labellings[0].cnt).toBe(0);

    const cacheKey = llmCacheKey(
      computeContentHash('An Article', content),
      'stub-model',
      'v1',
    );
    const {rows: cache} = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM llm_cache WHERE cache_key = $1',
      [cacheKey],
    );
    expect(cache[0].cnt).toBe(0);
  });

  it('re-drains awaiting Articles and leaves failed Articles alone', async () => {
    const awaiting = await insertPendingArticle('Deferred body to re-drain.');
    await pool.query(
      "UPDATE articles SET processing_state = 'awaiting' WHERE id = $1",
      [awaiting.articleId],
    );
    const failed = await insertPendingArticle('Permanently failed body.');
    await pool.query(
      "UPDATE articles SET processing_state = 'failed' WHERE id = $1",
      [failed.articleId],
    );

    labelProducer.clear();
    await labelling.redrainAwaiting();

    // The awaiting Article is re-enqueued; the failed one is not — a validation
    // failure is not retried by a re-drain. (Other suites may leave their own
    // awaiting Articles, so scope the assertion to this test's two ids.)
    expect(labelProducer.enqueued).toContain(awaiting.articleId);
    expect(labelProducer.enqueued).not.toContain(failed.articleId);
  });

  it('reprocesses a re-drained awaiting Article through to processed', async () => {
    const content = 'Body deferred during an outage, recovered on re-drain.';
    const {userId, articleId} = await insertPendingArticle(content);

    // Outage exhausts retries: the Article defers to `awaiting`.
    llm.failWith(new Error('provider timeout'));
    await labelling.labelArticle(articleId, {finalAttempt: true});
    llm.failWith(undefined);

    // The provider has recovered. The re-drained job runs the same seam again —
    // an `awaiting` Article is eligible — and this time it succeeds.
    llm.set(content, {
      summary: 'Recovered analysis.',
      importance: 'important',
      entities: [],
    });
    await labelling.labelArticle(articleId);

    const {rows: articles} = await pool.query(
      'SELECT processing_state, processing_error FROM articles WHERE id = $1',
      [articleId],
    );
    expect(articles[0].processing_state).toBe('processed');

    const {rows: labellings} = await pool.query(
      'SELECT user_id, summary FROM labellings WHERE article_id = $1',
      [articleId],
    );
    expect(labellings).toHaveLength(1);
    expect(labellings[0].user_id).toBe(userId);
    expect(labellings[0].summary).toBe('Recovered analysis.');
  });
});
