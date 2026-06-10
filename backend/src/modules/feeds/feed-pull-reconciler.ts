import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {FeedsRepository} from './feeds.repository';
import {
  FEED_PULL_SCHEDULER,
  FeedPullScheduler,
} from '../../infra/queues/feed-pull-scheduler';

/**
 * Reconciles the live pull schedule against the database on startup. Runs in
 * both the API and the worker (both import FeedsModule), so however the process
 * was last stopped, the set of repeatable jobs is brought back in line with the
 * active Feeds — registering any missing, dropping any orphaned.
 */
@Injectable()
export class FeedPullReconciler implements OnApplicationBootstrap {
  private readonly logger = new Logger(FeedPullReconciler.name);

  constructor(
    private readonly feeds: FeedsRepository,
    @Inject(FEED_PULL_SCHEDULER) private readonly scheduler: FeedPullScheduler,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const activeIds = await this.feeds.listActiveIds();
    await this.scheduler.reconcile(activeIds);
    this.logger.log(`reconcile outcome=synced active=${activeIds.length}`);
  }
}
