import request from 'supertest';
import {startE2EHarness, E2EHarness} from '../support/e2e-harness';

/** Register + confirm + login; returns the session cookie and userId. */
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

describe('Feeds (tenant-scoped)', () => {
  let harness: E2EHarness;

  beforeAll(async () => {
    harness = await startE2EHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(() => {
    harness.notifier.clear();
    harness.feedValidator.clear();
  });

  it('adds a valid Feed and returns it at status active', async () => {
    const {cookie} = await registerAndLogin(harness, 'add-valid@example.com');

    const res = await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', cookie)
      .send({url: 'https://blog.example.com/feed.xml'})
      .expect(201);

    expect(res.body).toMatchObject({
      url: 'https://blog.example.com/feed.xml',
      status: 'active',
    });
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });

  it('lists only the caller’s own Feeds after adding one', async () => {
    const {cookie} = await registerAndLogin(harness, 'list-own@example.com');

    await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', cookie)
      .send({url: 'https://news.example.com/rss'})
      .expect(201);

    const res = await request(harness.app.getHttpServer())
      .get('/feeds')
      .set('Cookie', cookie)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const urls = res.body.map((f: {url: string}) => f.url);
    expect(urls).toContain('https://news.example.com/rss');
    expect(res.body.every((f: {status: string}) => f.status === 'active')).toBe(
      true,
    );
  });

  it('rejects unauthenticated requests to any /feeds route with 401', async () => {
    await request(harness.app.getHttpServer()).get('/feeds').expect(401);

    await request(harness.app.getHttpServer())
      .post('/feeds')
      .send({url: 'https://anon.example.com/rss'})
      .expect(401);
  });

  it('never leaks another User’s Feeds across tenants', async () => {
    const userA = await registerAndLogin(harness, 'tenant-a-feeds@example.com');
    const userB = await registerAndLogin(harness, 'tenant-b-feeds@example.com');

    await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', userB.cookie)
      .send({url: 'https://only-b.example.com/rss'})
      .expect(201);

    const res = await request(harness.app.getHttpServer())
      .get('/feeds')
      .set('Cookie', userA.cookie)
      .expect(200);

    const urls = res.body.map((f: {url: string}) => f.url);
    expect(urls).not.toContain('https://only-b.example.com/rss');

    // Sanity: B still sees their own Feed.
    const bRes = await request(harness.app.getHttpServer())
      .get('/feeds')
      .set('Cookie', userB.cookie)
      .expect(200);
    expect(bRes.body.map((f: {url: string}) => f.url)).toContain(
      'https://only-b.example.com/rss',
    );
  });

  it.each([
    ['malformed', 'https://reject-malformed.example.com/feed'],
    ['unreachable', 'https://reject-unreachable.example.com/feed'],
    ['not-a-feed', 'https://reject-not-a-feed.example.com/'],
    ['timeout', 'https://reject-timeout.example.com/feed'],
  ] as const)(
    'rejects a %s URL with 4xx + reason and creates no Feed',
    async (reason, url) => {
      const {cookie} = await registerAndLogin(
        harness,
        `reject-${reason}@example.com`,
      );
      harness.feedValidator.set(url, {ok: false, reason});

      const res = await request(harness.app.getHttpServer())
        .post('/feeds')
        .set('Cookie', cookie)
        .send({url})
        .expect(400);
      expect(res.body.reason).toBe(reason);

      const list = await request(harness.app.getHttpServer())
        .get('/feeds')
        .set('Cookie', cookie)
        .expect(200);
      expect(list.body.map((f: {url: string}) => f.url)).not.toContain(url);
    },
  );

  it('rejects an empty URL with 4xx before reaching the validator probe', async () => {
    const {cookie} = await registerAndLogin(
      harness,
      'reject-empty@example.com',
    );

    const validate = jest.spyOn(harness.feedValidator, 'validate');
    await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', cookie)
      .send({url: ''})
      .expect(400);
    expect(validate).not.toHaveBeenCalled();
    validate.mockRestore();
  });

  it('allows two different Users to add the same URL but blocks a User’s own duplicate', async () => {
    const url = 'https://shared-outlet.example.com/feed';
    const userA = await registerAndLogin(harness, 'dup-a@example.com');
    const userB = await registerAndLogin(harness, 'dup-b@example.com');

    // Same Source, two Users -> two Feeds (US-17).
    await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', userA.cookie)
      .send({url})
      .expect(201);
    await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', userB.cookie)
      .send({url})
      .expect(201);

    // The same User re-adding their own URL is rejected by the unique index.
    await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', userA.cookie)
      .send({url})
      .expect(409);
  });
});
