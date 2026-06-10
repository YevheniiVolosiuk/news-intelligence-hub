import type {MigrationBuilder} from 'node-pg-migrate';

// Where an Article sits in the pipeline (CONTEXT.md, Processing State):
// pending -> filtered (deterministic pre-filter, no LLM) or processed
// (Labelling done); awaiting marks one deferred because the LLM was down.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('articles', {
    processing_state: {
      type: 'text',
      notNull: true,
      default: pgm.func("'pending'"),
      check:
        "processing_state IN ('pending', 'filtered', 'processed', 'awaiting')",
    },
    filtered_reason: {type: 'text'},
  });
}
