import request from 'supertest';
import {startE2EHarness, E2EHarness} from '../support/e2e-harness';

/**
 * Helper: register + confirm + login, returns session cookie and userId.
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

describe('GET /auth/users/:id (tenant scoping)', () => {
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

  it('returns the safe profile when the authenticated user requests their own ID', async () => {
    const email = 'own-profile@example.com';
    const {cookie, userId} = await registerAndLogin(harness, email);

    const res = await request(harness.app.getHttpServer())
      .get(`/auth/users/${userId}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body).toMatchObject({id: userId, email});
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('returns 404 when requesting another user by direct ID (cross-tenant isolation)', async () => {
    const userA = await registerAndLogin(harness, 'tenant-a@example.com');
    const userB = await registerAndLogin(harness, 'tenant-b@example.com');

    // User A's session tries to fetch User B's profile by direct ID.
    const res = await request(harness.app.getHttpServer())
      .get(`/auth/users/${userB.userId}`)
      .set('Cookie', userA.cookie)
      .expect(404);

    // Response must not leak any User B data.
    expect(res.body.email).toBeUndefined();
    expect(res.body.id).toBeUndefined();

    // Sanity: User A can still fetch their own profile.
    await request(harness.app.getHttpServer())
      .get(`/auth/users/${userA.userId}`)
      .set('Cookie', userA.cookie)
      .expect(200);
  });

  it('returns 401 when no session cookie is provided', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await request(harness.app.getHttpServer())
      .get(`/auth/users/${fakeId}`)
      .expect(401);
  });

  it('returns 404 for a nonexistent user ID even with a valid session', async () => {
    const {cookie} = await registerAndLogin(harness, 'edge-case@example.com');
    const nonexistent = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

    await request(harness.app.getHttpServer())
      .get(`/auth/users/${nonexistent}`)
      .set('Cookie', cookie)
      .expect(404);
  });
});
