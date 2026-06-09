import {Module} from '@nestjs/common';
import {FEED_VALIDATOR} from './feed-validator';
import {FeedsController} from './feeds.controller';
import {FeedsRepository} from './feeds.repository';
import {FeedsService} from './feeds.service';
import {HttpFeedValidator} from './http-feed-validator';

/**
 * Owns the Feeds domain: HTTP boundary, orchestration, and tenant-scoped data
 * access. Mirrors the auth/users module shape. The FeedValidator seam binds the
 * minimal HTTP probe in production and is overridden by a deterministic double
 * in the E2E harness.
 */
@Module({
  controllers: [FeedsController],
  providers: [
    FeedsService,
    FeedsRepository,
    {provide: FEED_VALIDATOR, useClass: HttpFeedValidator},
  ],
})
export class FeedsModule {}
