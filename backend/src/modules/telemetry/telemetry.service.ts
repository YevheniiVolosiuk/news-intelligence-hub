import {Injectable} from '@nestjs/common';
import {OperationSpendRow, TelemetryRepository} from './telemetry.repository';

/** Aggregate LLM spend for one `operation`, for the current User. */
export interface OperationSpend {
  operation: string;
  /** Real provider calls (cache_hit = false rows). */
  calls: number;
  /** Total tokens spent across those calls. */
  tokens: number;
  /** Calls the cache served instead of the provider (cache_hit = true rows). */
  callsSaved: number;
}

function toOperationSpend(row: OperationSpendRow): OperationSpend {
  return {
    operation: row.operation,
    calls: row.calls,
    tokens: row.tokens,
    callsSaved: row.calls_saved,
  };
}

@Injectable()
export class TelemetryService {
  constructor(private readonly telemetry: TelemetryRepository) {}

  /** The caller's spend, one aggregate per operation. */
  async spendByOperation(userId: string): Promise<OperationSpend[]> {
    const rows = await this.telemetry.aggregateByOperationForUser(userId);
    return rows.map(toOperationSpend);
  }
}
