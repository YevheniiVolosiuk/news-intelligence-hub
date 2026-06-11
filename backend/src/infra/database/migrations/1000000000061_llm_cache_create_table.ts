import type {MigrationBuilder} from 'node-pg-migrate';

// llm_cache memoises a completed LLM call so an unchanged Article/prompt reuses
// the stored result rather than spending a second call (CONTEXT.md: the cache a
// Reprocessing hits when content and labelling have not changed). It is shared
// accounting, not a per-User owned row, so it carries no user_id and no cascade:
// cache_key is the caller-computed identity (content_hash + model +
// prompt_version), stored alongside its parts for inspection.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('llm_cache', {
    cache_key: {type: 'text', primaryKey: true},
    content_hash: {type: 'text', notNull: true},
    model: {type: 'text', notNull: true},
    prompt_version: {type: 'text', notNull: true},
    result_json: {type: 'jsonb', notNull: true},
    prompt_tokens: {type: 'integer'},
    completion_tokens: {type: 'integer'},
    total_tokens: {type: 'integer'},
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
}
