import {createHash} from 'crypto';
import request from 'supertest';
import {startE2EHarness, E2EHarness} from '../support/e2e-harness';

describe('POST /auth/resend-confirmation', () => {
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

  it('issues a fresh token and invalidates prior outstanding tokens', async () => {
    const email = 'resend-happy@example.com';

    await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email, password: 'correct horse battery'})
      .expect(201);

    const firstRawToken = harness.notifier.lastFor(email)!.rawToken;

    // Resend confirmation.
    const res = await request(harness.app.getHttpServer())
      .post('/auth/resend-confirmation')
      .send({email})
      .expect(200);

    expect(res.body.status).toBe('sent');
    expect(res.body.email).toBe(email);

    // A new token should have been issued.
    const secondPayload = harness.notifier.lastFor(email)!;
    expect(secondPayload.rawToken).not.toBe(firstRawToken);

    // The old token should no longer be usable.
    await request(harness.app.getHttpServer())
      .post('/auth/confirm')
      .send({token: firstRawToken})
      .expect(404);

    // The new token should work.
    await request(harness.app.getHttpServer())
      .post('/auth/confirm')
      .send({token: secondPayload.rawToken})
      .expect(200);

    const {rows} = await harness.pool.query(
      'SELECT confirmed_at FROM users WHERE email = $1',
      [email],
    );
    expect(rows[0].confirmed_at).not.toBeNull();
  });

  it('returns success for an unregistered email without leaking existence', async () => {
    const res = await request(harness.app.getHttpServer())
      .post('/auth/resend-confirmation')
      .send({email: 'nobody@example.com'})
      .expect(200);

    expect(res.body.status).toBe('sent');
    expect(res.body.email).toBe('nobody@example.com');

    // No token should have been issued.
    expect(harness.notifier.captured).toHaveLength(0);
  });
});
