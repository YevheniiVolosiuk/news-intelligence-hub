import {createHash} from 'crypto';
import request from 'supertest';
import * as argon2 from 'argon2';
import {startE2EHarness, E2EHarness} from '../support/e2e-harness';

describe('POST /auth/register', () => {
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

  it('creates an unconfirmed User and issues one confirmation link', async () => {
    const email = 'tracer@example.com';

    await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email, password: 'correct horse battery'})
      .expect(201);

    const {rows} = await harness.pool.query(
      'SELECT email, confirmed_at FROM users WHERE email = $1',
      [email],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].confirmed_at).toBeNull();

    const links = harness.notifier.captured.filter(p => p.email === email);
    expect(links).toHaveLength(1);
    expect(links[0].confirmationUrl).toContain(links[0].rawToken);
  });

  it('stores the password only as an argon2id hash, never plaintext', async () => {
    const email = 'hashed@example.com';
    const password = 'super secret passphrase';

    await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email, password})
      .expect(201);

    const {rows} = await harness.pool.query(
      'SELECT password_hash FROM users WHERE email = $1',
      [email],
    );
    const stored: string = rows[0].password_hash;
    expect(stored).not.toContain(password);
    expect(stored.startsWith('$argon2id$')).toBe(true);
    await expect(argon2.verify(stored, password)).resolves.toBe(true);
  });

  it('stores the confirmation token hashed, not the raw token from the link', async () => {
    const email = 'token@example.com';

    await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email, password: 'correct horse battery'})
      .expect(201);

    const rawToken = harness.notifier.lastFor(email)!.rawToken;
    const {rows} = await harness.pool.query(
      `SELECT t.token_hash, t.consumed_at
         FROM email_confirmation_tokens t
         JOIN users u ON u.id = t.user_id
        WHERE u.email = $1`,
      [email],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toEqual(rawToken);
    expect(rows[0].consumed_at).toBeNull();

    const expectedHash = createHash('sha256').update(rawToken).digest('hex');
    expect(rows[0].token_hash).toEqual(expectedHash);
  });

  it('rejects a second registration of the same email with a clear conflict', async () => {
    const email = 'dupe@example.com';
    const body = {email, password: 'correct horse battery'};

    await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send(body)
      .expect(201);

    const res = await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send(body)
      .expect(409);

    expect(String(res.body.message)).toMatch(/already exists/i);

    const {rows} = await harness.pool.query(
      'SELECT count(*)::int AS n FROM users WHERE email = $1',
      [email],
    );
    expect(rows[0].n).toBe(1);
  });

  it('normalises email to lowercase and rejects a case-variant duplicate', async () => {
    await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email: 'Case.User@Example.com', password: 'correct horse battery'})
      .expect(201);

    await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email: 'case.user@example.COM', password: 'correct horse battery'})
      .expect(409);

    const {rows} = await harness.pool.query(
      "SELECT email::text AS email FROM users WHERE email = 'case.user@example.com'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('case.user@example.com');
  });

  it('rejects a malformed email with a field-level error and creates no User', async () => {
    const res = await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email: 'not-an-email', password: 'correct horse battery'})
      .expect(400);

    expect(JSON.stringify(res.body.message)).toMatch(/valid email/i);

    const {rows} = await harness.pool.query(
      "SELECT count(*)::int AS n FROM users WHERE email = 'not-an-email'",
    );
    expect(rows[0].n).toBe(0);
  });

  it('rejects a password below the minimum length with a field-level error', async () => {
    const email = 'weakpass@example.com';

    const res = await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email, password: 'short'})
      .expect(400);

    expect(JSON.stringify(res.body.message)).toMatch(/at least 12 characters/i);

    const {rows} = await harness.pool.query(
      'SELECT count(*)::int AS n FROM users WHERE email = $1',
      [email],
    );
    expect(rows[0].n).toBe(0);
  });

  it('rejects an empty password', async () => {
    await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email: 'emptypass@example.com', password: ''})
      .expect(400);
  });

  it('returns the dev-mode confirmation link state for the post-registration page', async () => {
    const email = 'devlink@example.com';

    const res = await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email, password: 'correct horse battery'})
      .expect(201);

    const issued = harness.notifier.lastFor(email)!;
    expect(res.body.devMode).toBe(true);
    expect(res.body.confirmationUrl).toBe(issued.confirmationUrl);
    expect(res.body.confirmationUrl).toContain(issued.rawToken);
  });
});
