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
    harness.feedPullProducer.clear();
    harness.feedPullScheduler.clear();
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

  it('pauses an active Feed, moving it to status paused', async () => {
    const {cookie} = await registerAndLogin(
      harness,
      'pause-active@example.com',
    );

    const added = await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', cookie)
      .send({url: 'https://pause-me.example.com/feed'})
      .expect(201);
    expect(added.body.status).toBe('active');

    const paused = await request(harness.app.getHttpServer())
      .post(`/feeds/${added.body.id}/pause`)
      .set('Cookie', cookie)
      .expect(200);
    expect(paused.body).toMatchObject({id: added.body.id, status: 'paused'});
  });

  it('resumes a paused Feed back to active, idempotent on repeats', async () => {
    const {cookie} = await registerAndLogin(harness, 'resume@example.com');

    const added = await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', cookie)
      .send({url: 'https://resume-me.example.com/feed'})
      .expect(201);
    const id = added.body.id;

    await request(harness.app.getHttpServer())
      .post(`/feeds/${id}/pause`)
      .set('Cookie', cookie)
      .expect(200);

    // Pausing again is harmless and leaves it paused.
    const pausedAgain = await request(harness.app.getHttpServer())
      .post(`/feeds/${id}/pause`)
      .set('Cookie', cookie)
      .expect(200);
    expect(pausedAgain.body.status).toBe('paused');

    const resumed = await request(harness.app.getHttpServer())
      .post(`/feeds/${id}/resume`)
      .set('Cookie', cookie)
      .expect(200);
    expect(resumed.body.status).toBe('active');

    // Resuming an active Feed is harmless and leaves it active.
    const resumedAgain = await request(harness.app.getHttpServer())
      .post(`/feeds/${id}/resume`)
      .set('Cookie', cookie)
      .expect(200);
    expect(resumedAgain.body.status).toBe('active');
  });

  it('returns 404 when pausing/resuming another User’s Feed and leaves it untouched', async () => {
    const userA = await registerAndLogin(harness, 'cross-a@example.com');
    const userB = await registerAndLogin(harness, 'cross-b@example.com');

    const added = await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', userB.cookie)
      .send({url: 'https://b-owns.example.com/feed'})
      .expect(201);
    const id = added.body.id;

    // A cannot see or act on B's Feed — same shape as a nonexistent id.
    await request(harness.app.getHttpServer())
      .post(`/feeds/${id}/pause`)
      .set('Cookie', userA.cookie)
      .expect(404);
    await request(harness.app.getHttpServer())
      .post(`/feeds/${id}/resume`)
      .set('Cookie', userA.cookie)
      .expect(404);

    // B's Feed is unchanged and still reachable to B.
    const bList = await request(harness.app.getHttpServer())
      .get('/feeds')
      .set('Cookie', userB.cookie)
      .expect(200);
    expect(bList.body.find((f: {id: string}) => f.id === id).status).toBe(
      'active',
    );
  });

  it('rejects unauthenticated pause/resume with 401', async () => {
    await request(harness.app.getHttpServer())
      .post('/feeds/00000000-0000-0000-0000-000000000000/pause')
      .expect(401);
    await request(harness.app.getHttpServer())
      .post('/feeds/00000000-0000-0000-0000-000000000000/resume')
      .expect(401);
  });

  it('deletes the caller’s Feed; it no longer appears in the list', async () => {
    const {cookie} = await registerAndLogin(harness, 'delete-own@example.com');

    const added = await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', cookie)
      .send({url: 'https://delete-me.example.com/feed'})
      .expect(201);
    const id = added.body.id;

    await request(harness.app.getHttpServer())
      .delete(`/feeds/${id}`)
      .set('Cookie', cookie)
      .expect(204);

    const list = await request(harness.app.getHttpServer())
      .get('/feeds')
      .set('Cookie', cookie)
      .expect(200);
    expect(list.body.map((f: {id: string}) => f.id)).not.toContain(id);
  });

  it('returns 404 on a second delete of the same Feed', async () => {
    const {cookie} = await registerAndLogin(
      harness,
      'double-delete@example.com',
    );

    const added = await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', cookie)
      .send({url: 'https://double-delete.example.com/feed'})
      .expect(201);
    const id = added.body.id;

    await request(harness.app.getHttpServer())
      .delete(`/feeds/${id}`)
      .set('Cookie', cookie)
      .expect(204);

    // Already gone — same shape as a nonexistent id.
    await request(harness.app.getHttpServer())
      .delete(`/feeds/${id}`)
      .set('Cookie', cookie)
      .expect(404);
  });

  it('returns 404 when deleting another User’s Feed and leaves it intact', async () => {
    const userA = await registerAndLogin(harness, 'del-cross-a@example.com');
    const userB = await registerAndLogin(harness, 'del-cross-b@example.com');

    const added = await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', userB.cookie)
      .send({url: 'https://b-keeps.example.com/feed'})
      .expect(201);
    const id = added.body.id;

    await request(harness.app.getHttpServer())
      .delete(`/feeds/${id}`)
      .set('Cookie', userA.cookie)
      .expect(404);

    // B's Feed survives and is still reachable to B.
    const bList = await request(harness.app.getHttpServer())
      .get('/feeds')
      .set('Cookie', userB.cookie)
      .expect(200);
    expect(bList.body.map((f: {id: string}) => f.id)).toContain(id);
  });

  it('rejects unauthenticated delete with 401', async () => {
    await request(harness.app.getHttpServer())
      .delete('/feeds/00000000-0000-0000-0000-000000000000')
      .expect(401);
  });

  it('accepts a manual pull of the caller’s Feed with 202 and enqueues exactly one job', async () => {
    const {cookie} = await registerAndLogin(harness, 'pull-own@example.com');

    const added = await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', cookie)
      .send({url: 'https://pull-me.example.com/feed'})
      .expect(201);
    const id = added.body.id;

    await request(harness.app.getHttpServer())
      .post(`/feeds/${id}/pull`)
      .set('Cookie', cookie)
      .expect(202);

    // Exactly one feed-pull job carrying this Feed's id.
    expect(harness.feedPullProducer.enqueued).toEqual([id]);
  });

  it('returns 404 when pulling another User’s Feed and enqueues nothing', async () => {
    const userA = await registerAndLogin(harness, 'pull-cross-a@example.com');
    const userB = await registerAndLogin(harness, 'pull-cross-b@example.com');

    const added = await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', userB.cookie)
      .send({url: 'https://b-pulls.example.com/feed'})
      .expect(201);

    // A cannot pull B's Feed — same shape as a nonexistent id.
    await request(harness.app.getHttpServer())
      .post(`/feeds/${added.body.id}/pull`)
      .set('Cookie', userA.cookie)
      .expect(404);

    expect(harness.feedPullProducer.enqueued).toEqual([]);
  });

  it('rejects an unauthenticated manual pull with 401', async () => {
    await request(harness.app.getHttpServer())
      .post('/feeds/00000000-0000-0000-0000-000000000000/pull')
      .expect(401);

    expect(harness.feedPullProducer.enqueued).toEqual([]);
  });

  it('registers a repeatable pull when a Feed is added', async () => {
    const {cookie} = await registerAndLogin(
      harness,
      'schedule-add@example.com',
    );

    const added = await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', cookie)
      .send({url: 'https://schedule-add.example.com/feed'})
      .expect(201);

    expect(harness.feedPullScheduler.scheduled.has(added.body.id)).toBe(true);
  });

  it('removes the repeatable when a Feed is paused', async () => {
    const {cookie} = await registerAndLogin(
      harness,
      'schedule-pause@example.com',
    );

    const added = await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', cookie)
      .send({url: 'https://schedule-pause.example.com/feed'})
      .expect(201);
    const id = added.body.id;
    expect(harness.feedPullScheduler.scheduled.has(id)).toBe(true);

    await request(harness.app.getHttpServer())
      .post(`/feeds/${id}/pause`)
      .set('Cookie', cookie)
      .expect(200);

    expect(harness.feedPullScheduler.scheduled.has(id)).toBe(false);
  });

  it('re-registers the repeatable when a paused Feed is resumed', async () => {
    const {cookie} = await registerAndLogin(
      harness,
      'schedule-resume@example.com',
    );

    const added = await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', cookie)
      .send({url: 'https://schedule-resume.example.com/feed'})
      .expect(201);
    const id = added.body.id;

    await request(harness.app.getHttpServer())
      .post(`/feeds/${id}/pause`)
      .set('Cookie', cookie)
      .expect(200);
    expect(harness.feedPullScheduler.scheduled.has(id)).toBe(false);

    await request(harness.app.getHttpServer())
      .post(`/feeds/${id}/resume`)
      .set('Cookie', cookie)
      .expect(200);

    expect(harness.feedPullScheduler.scheduled.has(id)).toBe(true);
  });

  it('removes the repeatable when a Feed is deleted, leaving no orphan', async () => {
    const {cookie} = await registerAndLogin(
      harness,
      'schedule-delete@example.com',
    );

    const added = await request(harness.app.getHttpServer())
      .post('/feeds')
      .set('Cookie', cookie)
      .send({url: 'https://schedule-delete.example.com/feed'})
      .expect(201);
    const id = added.body.id;
    expect(harness.feedPullScheduler.scheduled.has(id)).toBe(true);

    await request(harness.app.getHttpServer())
      .delete(`/feeds/${id}`)
      .set('Cookie', cookie)
      .expect(204);

    expect(harness.feedPullScheduler.scheduled.has(id)).toBe(false);
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
