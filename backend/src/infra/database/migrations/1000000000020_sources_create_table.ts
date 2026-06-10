import type {MigrationBuilder} from 'node-pg-migrate';

// A Source is the origin publication an Article came from (CONTEXT.md). Unlike a
// Feed it is shared across Users: two Users subscribing to the same outlet hold
// two Feeds but resolve to one Source row (ADR-0001, US-17).

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('sources', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    normalised_host: {type: 'text', notNull: true},
    title: {type: 'text'},
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // One outlet, one Source row: two Feeds at the same host must collapse here.
  pgm.addConstraint('sources', 'sources_normalised_host_unique', {
    unique: ['normalised_host'],
  });
}
