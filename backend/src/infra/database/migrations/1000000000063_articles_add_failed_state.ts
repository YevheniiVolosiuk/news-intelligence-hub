import type {MigrationBuilder} from 'node-pg-migrate';

// `failed` is the second non-success terminal of the Processing State, distinct
// from `awaiting` (CONTEXT.md): `awaiting` defers an Article because the LLM was
// *unavailable* (transient -- retryable), while `failed` marks one whose LLM call
// *returned an unusable result* (validation failure or other non-retryable error)
// and is not auto-retried. The two must not be conflated, so the vocabulary gains
// `failed` rather than reusing `awaiting`.

export async function up(pgm: MigrationBuilder): Promise<void> {
  // The original CHECK was defined inline on the column in
  // 1000000000050_articles_add_processing_state, so node-pg-migrate named it
  // `articles_processing_state_check`. Replace it with the five-state vocabulary.
  pgm.dropConstraint('articles', 'articles_processing_state_check');
  pgm.addConstraint('articles', 'articles_processing_state_check', {
    check:
      "processing_state IN ('pending', 'filtered', 'processed', 'awaiting', 'failed')",
  });
}
