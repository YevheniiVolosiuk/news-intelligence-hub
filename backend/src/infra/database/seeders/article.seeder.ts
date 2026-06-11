import {Pool} from 'pg';
import {SeededFeed} from './feed.seeder';
import {SeededSource} from './source.seeder';

export interface SeededArticle {
  id: string;
  processingState: string;
}

interface ArticleDefinition {
  url: string;
  normalisedUrl: string;
  title: string;
  content: string | null;
  contentHash: string;
  processingState: 'pending' | 'filtered';
  filteredReason: string | null;
  sourceHost: string;
  feedIndex: number;
}

/**
 * Demo articles spanning all 3 feeds and 3 sources.
 *
 * `pending` items have real-looking titles and long bodies (pass pre-filter).
 * `filtered` items are empty/short (caught by pre-filter heuristics).
 */
const DEMO_ARTICLES: ArticleDefinition[] = [
  // ── TechCrunch (source 0, feed 0) ──────────────────────────────
  {
    url: 'https://techcrunch.com/2025/01/ai-startup-raises-series-b',
    normalisedUrl: 'https://techcrunch.com/2025/01/ai-startup-raises-series-b',
    title: 'AI Startup Raises $200M Series B to Automate Enterprise Workflows',
    content:
      'The round was led by Sequoia Capital with participation from existing investors Andreessen Horowitz and Lightspeed Venture Partners. The company plans to use the funding to expand its engineering team and enter the European market. CEO Jane Smith said the platform now processes over 10 million documents per month for Fortune 500 clients across healthcare, finance, and logistics sectors.',
    contentHash:
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    processingState: 'pending',
    filteredReason: null,
    sourceHost: 'techcrunch.com',
    feedIndex: 0,
  },
  {
    url: 'https://techcrunch.com/2025/01/empty-tracking-pixel',
    normalisedUrl: 'https://techcrunch.com/2025/01/empty-tracking-pixel',
    title: '',
    content: null,
    contentHash:
      '0000000000000000000000000000000000000000000000000000000000000000',
    processingState: 'filtered',
    filteredReason: 'empty',
    sourceHost: 'techcrunch.com',
    feedIndex: 0,
  },
  // ── Reuters (source 1, feed 1) ─────────────────────────────────
  {
    url: 'https://www.reuters.com/world/europe/nato-summit-defence-spending',
    normalisedUrl:
      'https://www.reuters.com/world/europe/nato-summit-defence-spending',
    title: 'NATO Leaders Agree to Increase Defence Spending Target at Summit',
    content:
      'All 32 member states signed a new pledge to allocate at least 2.5 percent of GDP to defence within five years. The agreement marks a significant shift from the previous 2 percent benchmark and reflects growing concerns about security in Eastern Europe. Analysts expect the commitment to boost shares of major defence contractors across the continent.',
    contentHash:
      'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
    processingState: 'pending',
    filteredReason: null,
    sourceHost: 'www.reuters.com',
    feedIndex: 1,
  },
  {
    url: 'https://www.reuters.com/short-item',
    normalisedUrl: 'https://www.reuters.com/short-item',
    title: 'Hi',
    content: 'Ok',
    contentHash:
      '1111111111111111111111111111111111111111111111111111111111111111',
    processingState: 'filtered',
    filteredReason: 'below-min-length',
    sourceHost: 'www.reuters.com',
    feedIndex: 1,
  },
  // ── BBC (source 2, feed 2) ─────────────────────────────────────
  {
    url: 'https://www.bbc.co.uk/news/technology-quantum-computing-breakthrough',
    normalisedUrl:
      'https://www.bbc.co.uk/news/technology-quantum-computing-breakthrough',
    title: 'Quantum Computing Breakthrough Promises Faster Drug Discovery',
    content:
      'Researchers at the University of Bristol have demonstrated a new quantum algorithm that can simulate molecular interactions 100 times faster than classical computers. The team published their findings in Nature and say the approach could cut pharmaceutical R&D timelines from years to months. Industry partners including GSK and AstraZeneca have already expressed interest in licensing the technology for their drug-discovery pipelines.',
    contentHash:
      'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    processingState: 'pending',
    filteredReason: null,
    sourceHost: 'feeds.bbci.co.uk',
    feedIndex: 2,
  },
  {
    url: 'https://www.bbc.co.uk/news/cookie-banner-only',
    normalisedUrl: 'https://www.bbc.co.uk/news/cookie-banner-only',
    title: '',
    content:
      '<div class="cookie-banner">We use cookies to improve your experience</div>',
    contentHash:
      '2222222222222222222222222222222222222222222222222222222222222222',
    processingState: 'filtered',
    filteredReason: 'seo-boilerplate',
    sourceHost: 'feeds.bbci.co.uk',
    feedIndex: 2,
  },
  {
    url: 'https://www.bbc.co.uk/news/climate-antarctic-ice-melt',
    normalisedUrl: 'https://www.bbc.co.uk/news/climate-antarctic-ice-melt',
    title: 'Antarctic Ice Sheet Melting Faster Than Previously Estimated',
    content:
      'Satellite data analysed by NASA and the ESA shows that the Antarctic ice sheet is losing mass at a rate 30 percent higher than models predicted just five years ago. Scientists warn that the accelerated melt could contribute to sea-level rise of up to one metre by 2100, threatening coastal cities worldwide. The findings will be presented at the upcoming UN Climate Change Conference in Bonn.',
    contentHash:
      'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
    processingState: 'pending',
    filteredReason: null,
    sourceHost: 'feeds.bbci.co.uk',
    feedIndex: 2,
  },
];

/**
 * Upsert demo articles. Each article is linked to its source and feed.
 * Uses ON CONFLICT (normalised_url) DO NOTHING + fallback SELECT.
 */
export async function seedDemoArticles(
  pool: Pool,
  feeds: SeededFeed[],
  sources: SeededSource[],
): Promise<SeededArticle[]> {
  const sourceMap = new Map(sources.map(s => [s.normalisedHost, s.id]));
  const articles: SeededArticle[] = [];

  for (const def of DEMO_ARTICLES) {
    const sourceId = sourceMap.get(def.sourceHost);
    if (!sourceId) {
      throw new Error(
        `Demo seed: no source found for host "${def.sourceHost}"`,
      );
    }

    const feedId = feeds[def.feedIndex]?.id;
    if (!feedId) {
      throw new Error(
        `Demo seed: no feed found at index ${def.feedIndex} for "${def.url}"`,
      );
    }

    const {rows} = await pool.query<{id: string; processing_state: string}>(
      `INSERT INTO articles (
         source_id, feed_id, url, normalised_url, content_hash,
         title, content, processing_state, filtered_reason
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (normalised_url) DO NOTHING
       RETURNING id, processing_state`,
      [
        sourceId,
        feedId,
        def.url,
        def.normalisedUrl,
        def.contentHash,
        def.title || null,
        def.content,
        def.processingState,
        def.filteredReason,
      ],
    );

    if (rows.length > 0) {
      articles.push({
        id: rows[0].id,
        processingState: rows[0].processing_state,
      });
    } else {
      const existing = await pool.query<{id: string; processing_state: string}>(
        'SELECT id, processing_state FROM articles WHERE normalised_url = $1',
        [def.normalisedUrl],
      );
      if (existing.rows[0]) {
        articles.push({
          id: existing.rows[0].id,
          processingState: existing.rows[0].processing_state,
        });
      }
    }
  }

  return articles;
}
