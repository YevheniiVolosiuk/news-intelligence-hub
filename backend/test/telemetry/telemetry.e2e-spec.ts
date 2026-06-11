import request from 'supertest';
import {Pool} from 'pg';
import {startE2EHarness, E2EHarness} from '../support/e2e-harness';

/**
 * Seed one `llm_telemetry` ledger row for a User. Stands in for a labelling
 * outcome (the recording path is proven in the labelling suites); this slice
 * only exercises the read. A cache hit carries zero tokens, mirroring the
 * writer.
 */
async function recordTelemetry(
  pool: Pool,
  params: {
    userId: string;
    operation?: string;
    totalTokens?: number;
    cacheHit?: boolean;
  },
): Promise<void> {
  const cacheHit = params.cacheHit ?? false;
  const totalTokens = cacheHit ? 0 : (params.totalTokens ?? 0);
  await pool.query(
    `INSERT INTO llm_telemetry
       (operation, provider, model, prompt_tokens, completion_tokens,
        total_tokens, cache_hit, outcome, user_id, latency_ms)
     VALUES ($1, 'stub', 'stub-model', 0, 0, $2, $3, 'ok', $4, 5)`,
    [params.operation ?? 'processing', totalTokens, cacheHit, params.userId],
  );
}

/**
 * Helper: register + confirm + login, returns session cookie and userId.
 * Mirrors the auth e2e suites — the read endpoint is authenticated like the
 * rest of the API.
 */
async function registerAndLogin(
  harness: E2EHarness,
  email: string,
  password = 'correct horse battery',
) {
  await request(harness.app.getHttpServer())
    .post('/auth/register')
    .send({email, password})
    .expect(201);

  const rawToken = harness.notifier.lastFor(email)!.rawToken;
  await request(harness.app.getHttpServer())
    .post('/auth/confirm')
    .send({token: rawToken})
    .expect(200);

  const loginRes = await request(harness.app.getHttpServer())
    .post('/auth/login')
    .send({email, password})
    .expect(200);

  const setCookie = loginRes.headers['set-cookie'] as unknown as string[];
  const cookie = setCookie
    .find(c =>
      c.startsWith(`${process.env.SESSION_COOKIE_NAME ?? 'nih_session'}=`),
    )!
    .split(';')[0];

  return {cookie, userId: loginRes.body.id};
}

describe('GET /telemetry (LLM spend, tenant-scoped)', () => {
  let harness: E2EHarness;

  beforeAll(async () => {
    harness = await startE2EHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(() => {
    harness.notifier.clear();
  });

  it('returns 401 when no session cookie is provided', async () => {
    await request(harness.app.getHttpServer()).get('/telemetry').expect(401);
  });

  it('aggregates the caller spend by operation: calls, tokens, calls-saved', async () => {
    const {cookie, userId} = await registerAndLogin(
      harness,
      'spend-shape@example.com',
    );

    // A known set of labellings for this User: two real calls (250 + 100
    // tokens) and one cache hit (zero tokens, no provider call).
    await recordTelemetry(harness.pool, {userId, totalTokens: 250});
    await recordTelemetry(harness.pool, {userId, totalTokens: 100});
    await recordTelemetry(harness.pool, {userId, cacheHit: true});

    const res = await request(harness.app.getHttpServer())
      .get('/telemetry')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body).toEqual([
      {operation: 'processing', calls: 2, tokens: 350, callsSaved: 1},
    ]);
  });

  it('is tenant-scoped: a User never sees another User spend', async () => {
    const userA = await registerAndLogin(harness, 'tenant-a-spend@example.com');
    const userB = await registerAndLogin(harness, 'tenant-b-spend@example.com');

    // Only User B has any spend.
    await recordTelemetry(harness.pool, {
      userId: userB.userId,
      totalTokens: 999,
    });

    // User A sees nothing — never User B's ledger rows.
    const resA = await request(harness.app.getHttpServer())
      .get('/telemetry')
      .set('Cookie', userA.cookie)
      .expect(200);
    expect(resA.body).toEqual([]);

    // User B sees only their own spend.
    const resB = await request(harness.app.getHttpServer())
      .get('/telemetry')
      .set('Cookie', userB.cookie)
      .expect(200);
    expect(resB.body).toEqual([
      {operation: 'processing', calls: 1, tokens: 999, callsSaved: 0},
    ]);
  });
});
