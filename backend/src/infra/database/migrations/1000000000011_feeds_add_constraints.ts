import type {MigrationBuilder} from 'node-pg-migrate';

// Feeds are per-User; a Source is shared (US-17). Two Users may each hold a
// Feed for the same URL, but one User cannot hold the same URL twice.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addConstraint('feeds', 'feeds_user_url_unique', {
    unique: ['user_id', 'normalised_url'],
  });

  pgm.createIndex('feeds', 'user_id', {name: 'feeds_user_id_idx'});

  // Feed status vocabulary is fixed: active | paused | error. Slice 2 only
  // produces active/paused; `error` is reached by pull failures in Slice 3.
  pgm.addConstraint('feeds', 'feeds_status_check', {
    check: "status IN ('active', 'paused', 'error')",
  });
}
