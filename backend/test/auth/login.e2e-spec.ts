import request from 'supertest';
import {startE2EHarness, E2EHarness} from '../support/e2e-harness';

/**
 * Helper: register + confirm a user so they can log in.
 * Returns the email and password used.
 */
async function registerConfirmedUser(
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
}

describe('POST /auth/login', () => {
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

  it('returns the safe profile and sets an httpOnly session cookie for a confirmed user', async () => {
    const email = 'login-ok@example.com';
    const password = 'correct horse battery';
    await registerConfirmedUser(harness, email, password);

    const res = await request(harness.app.getHttpServer())
      .post('/auth/login')
      .send({email, password})
      .expect(200);

    // Body must contain safe profile fields, never the hash.
    expect(res.body).toMatchObject({email});
    expect(res.body.id).toBeDefined();
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password_hash');

    // httpOnly session cookie must be set.
    const setCookie = res.headers['set-cookie'] as unknown as
      | string[]
      | undefined;
    expect(setCookie).toBeDefined();
    const cookieHeader = setCookie!.find(c =>
      c.startsWith(`${process.env.SESSION_COOKIE_NAME ?? 'nih_session'}=`),
    );
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader!.toLowerCase()).toContain('httponly');
    expect(cookieHeader!.toLowerCase()).toContain('samesite');
  });

  it('blocks login for an unconfirmed user with a generic credentials error', async () => {
    const email = 'unconfirmed@example.com';
    const password = 'correct horse battery';

    // Register but do NOT confirm.
    await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email, password})
      .expect(201);

    const res = await request(harness.app.getHttpServer())
      .post('/auth/login')
      .send({email, password})
      .expect(401);

    expect(String(res.body.message)).toMatch(/invalid email or password/i);
  });

  it('rejects a wrong password with a generic credentials error', async () => {
    const email = 'wrongpass@example.com';
    await registerConfirmedUser(harness, email);

    const res = await request(harness.app.getHttpServer())
      .post('/auth/login')
      .send({email, password: 'this is very wrong'})
      .expect(401);

    expect(String(res.body.message)).toMatch(/invalid email or password/i);
  });

  it('rejects an unknown email with the same generic credentials error', async () => {
    const res = await request(harness.app.getHttpServer())
      .post('/auth/login')
      .send({email: 'nobody@example.com', password: 'correct horse battery'})
      .expect(401);

    expect(String(res.body.message)).toMatch(/invalid email or password/i);
  });

  it('wrong-password and unknown-email responses are indistinguishable', async () => {
    const email = 'indistinguishable@example.com';
    await registerConfirmedUser(harness, email);

    const wrongPass = await request(harness.app.getHttpServer())
      .post('/auth/login')
      .send({email, password: 'this is very wrong'});

    const unknownEmail = await request(harness.app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'no-such-user@example.com',
        password: 'correct horse battery',
      });

    expect(wrongPass.status).toBe(unknownEmail.status);
    expect(wrongPass.body.message).toBe(unknownEmail.body.message);
  });
});

describe('GET /auth/me', () => {
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

  /** Helper: register, confirm, and login — returns the session cookie string. */
  async function loginUser(
    email: string,
    password = 'correct horse battery',
  ): Promise<{cookie: string; userId: string}> {
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
    const cookie = setCookie.find(c =>
      c.startsWith(`${process.env.SESSION_COOKIE_NAME ?? 'nih_session'}=`),
    )!;
    // Extract just the name=value part (strip attributes after ';').
    const cookieValue = cookie.split(';')[0];
    return {cookie: cookieValue, userId: loginRes.body.id};
  }

  it('returns the safe profile for an authenticated user (cookie replay survives reload)', async () => {
    const email = 'me-ok@example.com';
    const {cookie} = await loginUser(email);

    // Simulate a new page load: send the cookie in a fresh request.
    const res = await request(harness.app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body).toMatchObject({email});
    expect(res.body.id).toBeDefined();
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('rejects a request without a session cookie', async () => {
    await request(harness.app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rejects a tampered token', async () => {
    const email = 'tampered@example.com';
    const {cookie} = await loginUser(email);

    // Tamper: flip one character in the JWT.
    const tampered = cookie.replace(/([a-zA-Z0-9_-])/, m =>
      m === 'a' ? 'b' : 'a',
    );

    await request(harness.app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', tampered)
      .expect(401);
  });

  it('rejects an expired token', async () => {
    const email = 'expired-jwt@example.com';
    // Use a short JWT TTL for this test.
    process.env.JWT_TTL = '1s';
    const {cookie} = await loginUser(email);

    // Wait for the token to expire.
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      await request(harness.app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(401);
    } finally {
      delete process.env.JWT_TTL;
    }
  });
});

describe('POST /auth/logout', () => {
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

  it('clears the session cookie', async () => {
    const email = 'logout-ok@example.com';
    const {cookie} = await registerAndLogin(harness, email);

    const res = await request(harness.app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(200);

    // The set-cookie header must clear (expire) the session cookie.
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'nih_session';
    const cleared = setCookie.find(c => c.startsWith(`${cookieName}=`));
    expect(cleared).toBeDefined();
    // Cookie should be expired — express uses either Max-Age=0 or a past Expires date.
    const lower = cleared!.toLowerCase();
    expect(lower.includes('max-age=0') || /expires=.*1970/.test(lower)).toBe(
      true,
    );
  });

  it('subsequent /me after logout is rejected', async () => {
    const email = 'logout-then-me@example.com';
    const {cookie} = await registerAndLogin(harness, email);

    await request(harness.app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(200);

    // After logout the browser deletes the cookie; /me without a valid cookie → 401.
    await request(harness.app.getHttpServer()).get('/auth/me').expect(401);
  });
});

describe('full session spine', () => {
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

  it('register → confirm → login → /me → logout → /me(401) → login again → /me(200)', async () => {
    const email = 'spine@example.com';
    const password = 'correct horse battery';

    // 1. Register
    await request(harness.app.getHttpServer())
      .post('/auth/register')
      .send({email, password})
      .expect(201);

    const rawToken = harness.notifier.lastFor(email)!.rawToken;

    // 2. Confirm
    await request(harness.app.getHttpServer())
      .post('/auth/confirm')
      .send({token: rawToken})
      .expect(200);

    // 3. Login — sets cookie
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

    // 4. /me — 200, own profile
    const meRes = await request(harness.app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(meRes.body).toMatchObject({email});

    // 5. Logout — clears cookie
    await request(harness.app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(200);

    // 6. /me — 401 (no valid session)
    await request(harness.app.getHttpServer()).get('/auth/me').expect(401);

    // 7. Login again with same credentials — succeeds
    const relogin = await request(harness.app.getHttpServer())
      .post('/auth/login')
      .send({email, password})
      .expect(200);

    const newSetCookie = relogin.headers['set-cookie'] as unknown as string[];
    const newCookie = newSetCookie
      .find(c =>
        c.startsWith(`${process.env.SESSION_COOKIE_NAME ?? 'nih_session'}=`),
      )!
      .split(';')[0];

    // 8. /me — 200 with fresh cookie
    const meRes2 = await request(harness.app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', newCookie)
      .expect(200);

    expect(meRes2.body).toMatchObject({email});
  });
});

/** Shared helper: register, confirm, and login — returns the session cookie. */
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
