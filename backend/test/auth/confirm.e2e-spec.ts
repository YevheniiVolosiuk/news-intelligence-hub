import {createHash} from 'crypto';
import request from 'supertest';
import {startE2EHarness, E2EHarness} from '../support/e2e-harness';

describe('POST /auth/confirm', () => {
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

  it('confirms email and marks the token consumed', async () => {
    const email = 'confirm-happy@example.com';

    // Register a user — this issues a confirmation token.
    await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email, password: 'correct horse battery'})
      .expect(201);

    const issued = harness.notifier.lastFor(email)!;
    const rawToken = issued.rawToken;

    // Confirm the email with the raw token from the link.
    const res = await request(harness.app.getHttpServer())
      .post('/auth/confirm')
      .send({token: rawToken})
      .expect(200);

    expect(res.body.status).toBe('confirmed');

    // The user should now have confirmed_at set.
    const {rows: userRows} = await harness.pool.query(
      'SELECT confirmed_at FROM users WHERE email = $1',
      [email],
    );
    expect(userRows).toHaveLength(1);
    expect(userRows[0].confirmed_at).not.toBeNull();

    // The token should be consumed.
    const {rows: tokenRows} = await harness.pool.query(
      `SELECT consumed_at
         FROM email_confirmation_tokens
        WHERE token_hash = $1`,
      [createHash('sha256').update(rawToken).digest('hex')],
    );
    expect(tokenRows).toHaveLength(1);
    expect(tokenRows[0].consumed_at).not.toBeNull();
  });

  it('rejects a reused token with a distinct "already used" outcome', async () => {
    const email = 'used-token@example.com';

    await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email, password: 'correct horse battery'})
      .expect(201);

    const rawToken = harness.notifier.lastFor(email)!.rawToken;

    // First use — succeeds.
    await request(harness.app.getHttpServer())
      .post('/auth/confirm')
      .send({token: rawToken})
      .expect(200);

    // Second use — rejected.
    const res = await request(harness.app.getHttpServer())
      .post('/auth/confirm')
      .send({token: rawToken})
      .expect(410);

    expect(String(res.body.message)).toMatch(/already been used/i);
  });

  it('rejects an expired token with a distinct outcome and offers to resend', async () => {
    const email = 'expired@example.com';

    // Use a short TTL so we can expire the token via the clock seam.
    process.env.CONFIRMATION_TOKEN_TTL_HOURS = '1';
    await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email, password: 'correct horse battery'})
      .expect(201);

    const rawToken = harness.notifier.lastFor(email)!.rawToken;

    // Advance the clock past the TTL.
    const realNow = new Date();
    const twoHoursLater = new Date(realNow.getTime() + 2 * 3600_000);
    harness.clock.now = () => twoHoursLater;

    try {
      const res = await request(harness.app.getHttpServer())
        .post('/auth/confirm')
        .send({token: rawToken})
        .expect(410);

      expect(String(res.body.message)).toMatch(/expired/i);
    } finally {
      // Restore real clock for subsequent tests.
      harness.clock.now = () => new Date();
      delete process.env.CONFIRMATION_TOKEN_TTL_HOURS;
    }
  });

  it('rejects a tampered or unknown token with 404', async () => {
    const res = await request(harness.app.getHttpServer())
      .post('/auth/confirm')
      .send({token: 'completely-made-up-token'})
      .expect(404);

    expect(String(res.body.message)).toMatch(/invalid/i);
  });
});
