import type {MigrationBuilder} from 'node-pg-migrate';

// Feeds gain pull bookkeeping so the already-present `error` status becomes
// reachable when the puller lands in Slice 3.4.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('feeds', {
    last_pulled_at: {type: 'timestamptz'},
    last_error: {type: 'text'},
  });
}
