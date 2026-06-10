import {Pool} from 'pg';
import {seedDemoUser, SeededUser} from './user.seeder';
import {seedDemoFeeds} from './feed.seeder';
import {seedDemoSources} from './source.seeder';
import {seedDemoArticles} from './article.seeder';

export interface DemoSeedResult {
  user: SeededUser;
  feeds: Array<{id: string; title: string}>;
  sources: Array<{id: string; normalisedHost: string}>;
  articles: Array<{id: string; processingState: string}>;
}

/**
 * Populate the database with demo data for review.
 *
 * Safe to re-run — every upsert is idempotent.  This is NOT wired into
 * app startup; Slice 11 will add `docker compose up` integration.
 */
export async function seedDemoData(pool: Pool): Promise<DemoSeedResult> {
  const user = await seedDemoUser(pool);
  const feeds = await seedDemoFeeds(pool, user.id);
  const sources = await seedDemoSources(pool);
  const articles = await seedDemoArticles(pool, feeds, sources);

  return {
    user,
    feeds,
    sources,
    articles,
  };
}
