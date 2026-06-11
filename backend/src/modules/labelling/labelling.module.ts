import {Module} from '@nestjs/common';
import {LabellingService} from './labelling.service';
import {LabellingsRepository} from './labellings.repository';
import {LlmCacheRepository} from './llm-cache.repository';
import {FeedsModule} from '../feeds/feeds.module';
import {IngestionModule} from '../ingestion/ingestion.module';
import {LlmModule} from '../../infra/llm/llm.module';

/**
 * Owns the labelling flow: resolve owner → reach the LLM → persist a Labelling.
 * Imports FeedsModule (owning-User lookup), IngestionModule (ArticlesRepository),
 * and LlmModule (the LLM_SERVICE seam, overridden with StubLlmService in tests).
 */
@Module({
  imports: [FeedsModule, IngestionModule, LlmModule],
  providers: [LabellingService, LabellingsRepository, LlmCacheRepository],
  exports: [LabellingService],
})
export class LabellingModule {}
