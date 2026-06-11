import {Inject, Injectable} from '@nestjs/common';
import {Pool} from 'pg';
import {PG_POOL} from '../../infra/database/database.module';
import {
  ArticleAnalysisResult,
  parseAnalysisResult,
} from '../../infra/llm/article-analysis';

export interface InsertLlmCacheParams {
  cacheKey: string;
  contentHash: string;
  model: string;
  promptVersion: string;
  resultJson: ArticleAnalysisResult;
}

/**
 * The content-hash LLM cache (FR-10): shared, un-owned accounting that lets an
 * unchanged Article reuse a prior analysis instead of spending a second provider
 * call. `cache_key` is the caller-computed identity (see `llmCacheKey`); the row
 * stores only validated results, so a hit can be trusted as a Labelling.
 */
@Injectable()
export class LlmCacheRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Return the cached analysis for `cacheKey`, or null on a miss. The stored
   * `result_json` is re-validated against the shared schema on the way out, so a
   * corrupted or legacy row can never masquerade as a valid Labelling.
   */
  async find(cacheKey: string): Promise<ArticleAnalysisResult | null> {
    const {rows} = await this.pool.query<{result_json: unknown}>(
      'SELECT result_json FROM llm_cache WHERE cache_key = $1',
      [cacheKey],
    );
    if (rows.length === 0) return null;
    return parseAnalysisResult(rows[0].result_json);
  }

  /**
   * Memoise a validated analysis. `ON CONFLICT (cache_key) DO NOTHING` keeps the
   * write idempotent: two Articles with identical content labelled concurrently
   * race to insert the same key, and the loser is a harmless no-op rather than an
   * error. Token columns are left null — the `LlmService` seam does not surface
   * usage counts (telemetry is a later slice).
   */
  async insert(params: InsertLlmCacheParams): Promise<void> {
    await this.pool.query(
      `INSERT INTO llm_cache
         (cache_key, content_hash, model, prompt_version, result_json)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (cache_key) DO NOTHING`,
      [
        params.cacheKey,
        params.contentHash,
        params.model,
        params.promptVersion,
        JSON.stringify(params.resultJson),
      ],
    );
  }
}
