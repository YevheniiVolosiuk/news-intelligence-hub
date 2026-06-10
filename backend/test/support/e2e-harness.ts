import {INestApplication, ValidationPipe} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import cookieParser = require('cookie-parser');
import {Pool} from 'pg';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {AppModule} from '../../src/app.module';
import {CONFIRMATION_LINK_NOTIFIER} from '../../src/modules/auth/confirmation-link-notifier';
import {CLOCK} from '../../src/common/utils/clock';
import {FEED_VALIDATOR} from '../../src/modules/feeds/feed-validator';
import {FEED_FETCHER} from '../../src/modules/ingestion/feed-fetcher';
import {runMigrations} from '../../src/infra/database/migrate';
import {CapturingConfirmationLinkNotifier} from './capturing-notifier';
import {StubFeedValidator} from './stub-feed-validator';
import {StubFeedFetcher} from './stub-feed-fetcher';

export interface E2EHarness {
  app: INestApplication;
  pool: Pool;
  notifier: CapturingConfirmationLinkNotifier;
  /** Deterministic FeedValidator double; stub specific URLs to force results. */
  feedValidator: StubFeedValidator;
  /** Deterministic FeedFetcher double; stub specific URLs to return feed XML. */
  feedFetcher: StubFeedFetcher;
  /** Mutate this to control what the clock returns during the test. */
  clock: {now: () => Date};
  close: () => Promise<void>;
}

/**
 * Boots the real NestJS app against a disposable Postgres (Testcontainers) with
 * the migrations applied and the notifier seam replaced by a capturing double.
 * This is the prior art Slices 1.2-1.4 and Slice 2+ extend; tests drive the app
 * through its HTTP boundary and read confirmation tokens off `notifier`.
 */
export async function startE2EHarness(): Promise<E2EHarness> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:17',
  ).start();
  const databaseUrl = container.getConnectionUri();

  // Every infra helper reads the connection from env, so point them at the
  // container before anything builds a pool.
  process.env.DATABASE_URL = databaseUrl;
  process.env.APP_BASE_URL =
    process.env.APP_BASE_URL ?? 'http://localhost:3000';
  process.env.DEV_MODE_CONFIRMATION = 'true';

  await runMigrations(databaseUrl);

  const notifier = new CapturingConfirmationLinkNotifier();
  const feedValidator = new StubFeedValidator();
  const feedFetcher = new StubFeedFetcher();
  const clockState = {now: () => new Date()};
  const moduleRef = await Test.createTestingModule({imports: [AppModule]})
    .overrideProvider(CONFIRMATION_LINK_NOTIFIER)
    .useValue(notifier)
    .overrideProvider(FEED_VALIDATOR)
    .useValue(feedValidator)
    .overrideProvider(FEED_FETCHER)
    .useValue(feedFetcher)
    .overrideProvider(CLOCK)
    .useFactory({factory: () => () => clockState.now()})
    .compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({whitelist: true, transform: true}));
  await app.init();

  const pool = new Pool({connectionString: databaseUrl});

  return {
    app,
    pool,
    notifier,
    feedValidator,
    feedFetcher,
    clock: clockState,
    close: async () => {
      await pool.end().catch(() => undefined);
      await app.close();
      await container.stop();
    },
  };
}
