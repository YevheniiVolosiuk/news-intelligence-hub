import {Module} from '@nestjs/common';
import {FEED_VALIDATOR} from './feed-validator';
import {FeedsController} from './feeds.controller';
import {FeedsRepository} from './feeds.repository';
import {FeedsService} from './feeds.service';
import {FeedPullReconciler} from './feed-pull-reconciler';
import {HttpFeedValidator} from './http-feed-validator';
import {FEED_PULL_PRODUCER} from '../../infra/queues/feed-pull-producer';
import {BullFeedPullProducer} from '../../infra/queues/bull-feed-pull-producer';
import {FEED_PULL_SCHEDULER} from '../../infra/queues/feed-pull-scheduler';
import {BullFeedPullScheduler} from '../../infra/queues/bull-feed-pull-scheduler';

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
    {provide: FEED_VALIDATOR, useFactory: () => new HttpFeedValidator()},
    {provide: FEED_PULL_PRODUCER, useClass: BullFeedPullProducer},
    {provide: FEED_PULL_SCHEDULER, useClass: BullFeedPullScheduler},
    FeedPullReconciler,
  ],
  exports: [FeedsRepository],
})
export class FeedsModule {}
