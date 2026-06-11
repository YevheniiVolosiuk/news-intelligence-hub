import type {MigrationBuilder} from 'node-pg-migrate';

// llm_telemetry is the accounting of LLM spend: one row per call, attributing
// token counts and outcome to an operation type (CONTEXT.md: "telemetry" means
// LLM spend accounting specifically, not logs). It is shared accounting, not a
// per-User owned row, so article_id/user_id are nullable provenance with
// ON DELETE SET NULL: the spend record must survive the Article or User it
// described, or deleting either would erase the cost history. `outcome` is left
// free-text here; its vocabulary is pinned by the labelling slice that writes it.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('llm_telemetry', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    operation: {type: 'text', notNull: true},
    provider: {type: 'text', notNull: true},
    model: {type: 'text', notNull: true},
    prompt_tokens: {type: 'integer'},
    completion_tokens: {type: 'integer'},
    total_tokens: {type: 'integer'},
    cache_hit: {type: 'boolean', notNull: true},
    outcome: {type: 'text', notNull: true},
    article_id: {
      type: 'uuid',
      references: 'articles',
      onDelete: 'SET NULL',
    },
    user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'SET NULL',
    },
    latency_ms: {type: 'integer'},
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
}
