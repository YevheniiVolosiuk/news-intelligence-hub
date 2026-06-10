import {Pool} from 'pg';

export interface SeededFeed {
  id: string;
  title: string;
}

interface FeedDefinition {
  url: string;
  normalisedUrl: string;
  title: string;
}

const DEMO_FEEDS: FeedDefinition[] = [
  {
    url: 'https://techcrunch.com/feed/',
    normalisedUrl: 'https://techcrunch.com/feed/',
    title: 'TechCrunch',
  },
  {
    url: 'https://www.reuters.com/rssFeed/worldNews',
    normalisedUrl: 'https://www.reuters.com/rssfeed/worldnews',
    title: 'Reuters World News',
  },
  {
    url: 'https://feeds.bbci.co.uk/news/rss.xml',
    normalisedUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
    title: 'BBC News',
  },
];

/**
 * Upsert demo feeds for the given user.
 * Uses ON CONFLICT DO NOTHING + fallback SELECT for idempotency.
 */
export async function seedDemoFeeds(
  pool: Pool,
  userId: string,
): Promise<SeededFeed[]> {
  const feeds: SeededFeed[] = [];

  for (const def of DEMO_FEEDS) {
    const {rows} = await pool.query<{id: string; title: string}>(
      `INSERT INTO feeds (user_id, url, normalised_url, title)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, normalised_url) DO NOTHING
       RETURNING id, title`,
      [userId, def.url, def.normalisedUrl, def.title],
    );

    if (rows.length > 0) {
      feeds.push(rows[0]);
    } else {
      const existing = await pool.query<{id: string; title: string}>(
        `SELECT id, title FROM feeds
         WHERE user_id = $1 AND normalised_url = $2`,
        [userId, def.normalisedUrl],
      );
      feeds.push(existing.rows[0]);
    }
  }

  return feeds;
}
