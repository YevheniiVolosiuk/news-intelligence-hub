import {Inject, Injectable} from '@nestjs/common';
import {Pool} from 'pg';
import {PG_POOL} from '../../infra/database/database.module';

export interface RecordTelemetryParams {
  operation: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheHit: boolean;
  outcome: string;
  articleId: string;
  userId: string;
  latencyMs: number;
}

/**
 * LLM spend accounting (FR-10): one `llm_telemetry` row per labelling outcome,
 * cache hits included. The table is the ledger the spend metrics are derived
 * from — real calls are the rows where `cache_hit = false`, total spend is the
 * sum of `total_tokens`, and calls saved are the `cache_hit = true` rows (which
 * carry zero tokens). This is shared accounting, written from the worker only.
 */
@Injectable()
export class LlmTelemetryRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Append one immutable accounting row. Never updates or upserts: each
   * labelling outcome is its own line in the ledger.
   */
  async record(params: RecordTelemetryParams): Promise<void> {
    await this.pool.query(
      `INSERT INTO llm_telemetry
         (operation, provider, model, prompt_tokens, completion_tokens,
          total_tokens, cache_hit, outcome, article_id, user_id, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        params.operation,
        params.provider,
        params.model,
        params.promptTokens,
        params.completionTokens,
        params.totalTokens,
        params.cacheHit,
        params.outcome,
        params.articleId,
        params.userId,
        params.latencyMs,
      ],
    );
  }
}
