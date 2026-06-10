import {Inject, Injectable, Logger} from '@nestjs/common';
import {FEED_FETCHER, FeedFetcher} from './feed-fetcher';
import {FeedsRepository} from '../feeds/feeds.repository';
import {SourcesRepository} from './sources.repository';
import {ArticlesRepository} from './articles.repository';
import {parseFeed} from '../../common/utils/feed-parser';
import {normaliseUrl} from '../../common/utils/url';
import {computeContentHash} from '../../common/utils/content-hash';
import {preFilter} from '../../common/utils/pre-filter';

export interface PullSummary {
  pulled: number;
  inserted: number;
  filtered: number;
  skipped: number;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly feedsRepo: FeedsRepository,
    private readonly sourcesRepo: SourcesRepository,
    private readonly articlesRepo: ArticlesRepository,
    @Inject(FEED_FETCHER) private readonly fetcher: FeedFetcher,
  ) {}

  /**
   * Pull a single feed: fetch → parse → upsert source + articles.
   *
   * Idempotent: re-pulling the same feed skips existing articles.
   * Paused feeds are no-ops. Fetch/parse failures move the feed to `error`.
   */
  async pullFeed(feedId: string): Promise<PullSummary> {
    const feed = await this.feedsRepo.findById(feedId);
    if (!feed) {
      this.logger.log(`pull-feed outcome=not-found feedId=${feedId}`);
      return {pulled: 0, inserted: 0, filtered: 0, skipped: 0};
    }

    if (feed.status === 'paused') {
      this.logger.log(`pull-feed outcome=paused feedId=${feedId}`);
      return {pulled: 0, inserted: 0, filtered: 0, skipped: 0};
    }

    // Fetch
    const fetchResult = await this.fetcher.fetch(feed.url);
    if (!fetchResult.ok) {
      await this.feedsRepo.updatePullError(feedId, `fetch: ${fetchResult.reason}`);
      this.logger.log(
        `pull-feed outcome=fetch-error reason=${fetchResult.reason} feedId=${feedId}`,
      );
      return {pulled: 0, inserted: 0, filtered: 0, skipped: 0};
    }

    // Parse
    const parseResult = parseFeed(fetchResult.body);
    if (!parseResult.ok) {
      await this.feedsRepo.updatePullError(feedId, `parse: ${parseResult.reason}`);
      this.logger.log(
        `pull-feed outcome=parse-error reason=${parseResult.reason} feedId=${feedId}`,
      );
      return {pulled: 0, inserted: 0, filtered: 0, skipped: 0};
    }

    // Upsert source
    const host = new URL(feed.url).hostname.toLowerCase();
    const source = await this.sourcesRepo.findOrCreate(host, parseResult.sourceTitle);

    // Process items
    const summary: PullSummary = {
      pulled: parseResult.items.length,
      inserted: 0,
      filtered: 0,
      skipped: 0,
    };

    for (const item of parseResult.items) {
      const itemUrl = item.link || '';
      const normalisedItemUrl = itemUrl ? normaliseUrl(itemUrl) : '';
      const contentHash = computeContentHash(item.title ?? '', item.content ?? '');

      // Pre-filter
      const filterResult = preFilter({
        title: item.title ?? '',
        content: item.content ?? '',
      });

      const processingState = filterResult.state === 'pending' ? 'pending' as const : 'filtered' as const;
      const filteredReason =
        filterResult.state === 'filtered' ? filterResult.reason : null;

      const inserted = await this.articlesRepo.createIfNotExists({
        sourceId: source.id,
        feedId,
        url: itemUrl,
        normalisedUrl: normalisedItemUrl,
        contentHash,
        title: item.title ?? null,
        content: item.content ?? null,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
        processingState,
        filteredReason,
      });

      if (inserted) {
        if (processingState === 'filtered') {
          summary.filtered++;
        } else {
          summary.inserted++;
        }
      } else {
        summary.skipped++;
      }
    }

    // Mark feed as successfully pulled
    await this.feedsRepo.updatePullSuccess(feedId);
    this.logger.log(
      `pull-feed outcome=ok feedId=${feedId} pulled=${summary.pulled} inserted=${summary.inserted} filtered=${summary.filtered} skipped=${summary.skipped}`,
    );

    return summary;
  }
}
