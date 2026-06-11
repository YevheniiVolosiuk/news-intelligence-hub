import {Module} from '@nestjs/common';
import {createLlmService} from './llm-service.factory';
import {LLM_SERVICE} from './llm-service';

/**
 * Owns the provider-agnostic LLM boundary (FR-3). Binds `LLM_SERVICE` to the
 * adapter chosen from `LLM_PROVIDER`; downstream modules (the label worker)
 * import this module and inject the token, never a concrete adapter. The seam is
 * overridden with `StubLlmService` in tests.
 */
@Module({
  providers: [{provide: LLM_SERVICE, useFactory: () => createLlmService()}],
  exports: [LLM_SERVICE],
})
export class LlmModule {}
