import {Module} from '@nestjs/common';
import {DatabaseModule} from './infra/database/database.module';
import {FeedsModule} from './modules/feeds/feeds.module';
import {IngestionModule} from './modules/ingestion/ingestion.module';

/**
 * NestJS module for the worker process. Boots as an ApplicationContext
 * (no HTTP server) so the worker shares DI, Postgres pool, and the
 * FeedFetcher/Pre-Filter seams with the API.
 */
@Module({
  imports: [DatabaseModule, FeedsModule, IngestionModule],
})
export class WorkerModule {}
