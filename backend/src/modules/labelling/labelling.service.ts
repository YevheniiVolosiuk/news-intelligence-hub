import {Inject, Injectable, Logger} from '@nestjs/common';
import {FeedsRepository} from '../feeds/feeds.repository';
import {ArticlesRepository} from '../ingestion/articles.repository';
import {LabellingsRepository} from './labellings.repository';
import {LlmCacheRepository} from './llm-cache.repository';
import {LlmTelemetryRepository} from './llm-telemetry.repository';
import {
  LLM_SERVICE,
  LlmService,
  PROMPT_VERSION,
  TokenUsage,
} from '../../infra/llm/llm-service';
import {llmCacheKey} from '../../infra/llm/llm-cache-key';

/**
 * The single telemetry `operation` this slice writes: an Article being labelled.
 * Regeneration and digest spend arrive on rows their own slices will write.
 */
const OPERATION = 'processing';

/** A cache hit spends nothing — its accounting row carries zero tokens. */
const ZERO_USAGE: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

/**
 * Entry seam for the labelling flow, the analogue of `IngestionService.pullFeed`
 * and the unit a single `article-label` job drives. Given an Article id it
 * resolves the owning User, reaches the LLM (only ever from here — the worker,
 * never an HTTP handler; Principle 3), and persists exactly one Labelling,
 * leaving the Article in the `processed` terminal.
 */
@Injectable()
export class LabellingService {
  private readonly logger = new Logger(LabellingService.name);

  constructor(
    private readonly articlesRepo: ArticlesRepository,
    private readonly feedsRepo: FeedsRepository,
    private readonly labellingsRepo: LabellingsRepository,
    private readonly llmCacheRepo: LlmCacheRepository,
    private readonly telemetryRepo: LlmTelemetryRepository,
    @Inject(LLM_SERVICE) private readonly llm: LlmService,
  ) {}

  async labelArticle(articleId: string): Promise<void> {
    const article = await this.articlesRepo.findById(articleId);
    if (!article) {
      this.logger.log(`label-article outcome=not-found articleId=${articleId}`);
      return;
    }

    // A pre-filtered (or failed) Article bypasses the LLM by definition; only a
    // `pending` Article — or a `processed` one being re-labelled by a job re-run
    // — is eligible. Guard before the LLM call so a filtered Article never
    // reaches a provider.
    if (
      article.processing_state !== 'pending' &&
      article.processing_state !== 'processed'
    ) {
      this.logger.log(
        `label-article outcome=skipped state=${article.processing_state} articleId=${articleId}`,
      );
      return;
    }

    // One provider call per *distinct content* (FR-10), not per Article: an
    // unchanged Article under the same model + prompt_version reuses a prior
    // analysis. On a miss we call the provider and memoise only the validated
    // result — a throw (outage or validation failure) writes nothing below.
    const contentHash = article.content_hash ?? '';
    const cacheKey = llmCacheKey(contentHash, this.llm.model, PROMPT_VERSION);
    const startedAt = Date.now();
    let analysis = await this.llmCacheRepo.find(cacheKey);
    let cacheHit = true;
    let usage = ZERO_USAGE;
    if (analysis) {
      this.logger.log(`label-article cache=hit articleId=${articleId}`);
    } else {
      cacheHit = false;
      const result = await this.llm.analyzeArticle({
        title: article.title ?? '',
        content: article.content ?? '',
      });
      analysis = result.analysis;
      usage = result.usage;
      await this.llmCacheRepo.insert({
        cacheKey,
        contentHash,
        model: this.llm.model,
        promptVersion: PROMPT_VERSION,
        resultJson: analysis,
      });
    }
    const latencyMs = Date.now() - startedAt;

    const userId = article.feed_id
      ? await this.feedsRepo.findUserId(article.feed_id)
      : null;
    if (!userId) {
      this.logger.log(`label-article outcome=no-owner articleId=${articleId}`);
      return;
    }

    await this.labellingsRepo.upsert({
      userId,
      articleId,
      summary: analysis.summary,
      importance: analysis.importance,
      entities: analysis.entities,
      model: this.llm.model,
      promptVersion: PROMPT_VERSION,
    });

    await this.articlesRepo.markProcessed(articleId);

    // One accounting row per labelling outcome, cache hits included (FR-10): a
    // real call records its tokens with cache_hit=false; a hit records zero
    // tokens with cache_hit=true, which is the calls-saved signal.
    await this.telemetryRepo.record({
      operation: OPERATION,
      provider: this.llm.provider,
      model: this.llm.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      cacheHit,
      outcome: 'ok',
      articleId,
      userId,
      latencyMs,
    });

    this.logger.log(
      `label-article outcome=ok articleId=${articleId} userId=${userId} importance=${analysis.importance}`,
    );
  }
}
