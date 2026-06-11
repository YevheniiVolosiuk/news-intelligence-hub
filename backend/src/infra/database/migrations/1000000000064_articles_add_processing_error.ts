import type {MigrationBuilder} from 'node-pg-migrate';

// The last error that drove an Article into a non-success terminal (Slice 4.6).
// `awaiting` records the provider outage that deferred it (so an operator sees
// *why* it is waiting before a re-drain); `failed` records the validation error
// that fast-failed it (so the prompt/model fix it signals is visible). A
// `pending`/`filtered`/`processed` Article carries null here -- nothing went
// wrong. Nullable, no CHECK: it is a human-facing diagnostic string, not part of
// the state machine.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('articles', {
    processing_error: {type: 'text'},
  });
}
