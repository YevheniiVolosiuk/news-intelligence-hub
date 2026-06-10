import {Module} from '@nestjs/common';
import {FEED_FETCHER} from './feed-fetcher';
import {HttpFeedFetcher} from './http-feed-fetcher';
import {IngestionService} from './ingestion.service';
import {SourcesRepository} from './sources.repository';
import {ArticlesRepository} from './articles.repository';
import {FeedsModule} from '../feeds/feeds.module';

/**
 * Owns the ingestion pipeline: fetch → parse → pre-filter → store.
 * Imports FeedsModule to access FeedsRepository (system-level feed lookups).
 * FeedFetcher seam is overridden with StubFeedFetcher in the E2E harness.
 */
@Module({
  imports: [FeedsModule],
  providers: [
    IngestionService,
    SourcesRepository,
    ArticlesRepository,
    {provide: FEED_FETCHER, useFactory: () => new HttpFeedFetcher()},
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
