import {Inject, Injectable} from '@nestjs/common';
import {Pool} from 'pg';
import {PG_POOL} from '../../infra/database/database.module';

/** One aggregate row from the `llm_telemetry` ledger, per operation. */
export interface OperationSpendRow {
  operation: string;
  calls: number;
  tokens: number;
  calls_saved: number;
}

/**
 * Read-side data access for the `llm_telemetry` ledger. Tenancy travels with the
 * query: every aggregate is scoped by `user_id` (Principle 4 / ADR-0001), so a
 * User's spend is never reachable without their id. The write side lives in the
 * labelling module — this module only ever reads.
 */
@Injectable()
export class TelemetryRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Aggregate the caller's spend per operation: real calls are the
   * `cache_hit = false` rows, total spend is the sum of `total_tokens`, and
   * calls saved are the `cache_hit = true` rows (which carry zero tokens).
   */
  async aggregateByOperationForUser(
    userId: string,
  ): Promise<OperationSpendRow[]> {
    const {rows} = await this.pool.query<OperationSpendRow>(
      `SELECT
         operation,
         COUNT(*) FILTER (WHERE NOT cache_hit)::int AS calls,
         COALESCE(SUM(total_tokens), 0)::int        AS tokens,
         COUNT(*) FILTER (WHERE cache_hit)::int      AS calls_saved
       FROM llm_telemetry
       WHERE user_id = $1
       GROUP BY operation
       ORDER BY operation`,
      [userId],
    );
    return rows;
  }
}
