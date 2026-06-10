import type {MigrationBuilder} from 'node-pg-migrate';

// A Feed is a User's subscription to one RSS/Atom URL (CONTEXT.md). Tenancy is a
// data-layer concern: every Feed belongs to exactly one User and is only ever
// read/mutated through `WHERE id = $1 AND user_id = $2` (the Slice 1 primitive).

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('feeds', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    // ON DELETE CASCADE is intentional: a Feed is a User's private subscription
    // (it has no meaning without its owner), so deleting a User removes that
    // User's Feeds. This is the *opposite* of the Article -> Feed rule
    // in ADR-0001: deleting a Feed must DETACH shared Articles (ON DELETE SET
    // NULL), never cascade them away. Owned subscription => cascade; shared
    // content => detach.
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    url: {type: 'text', notNull: true},
    // Normalised form (lowercased host, no trailing slash) backing the per-User
    // uniqueness rule. The raw `url` is kept for display.
    normalised_url: {type: 'text', notNull: true},
    title: {type: 'text'},
    // Feed status vocabulary is fixed: active | paused | error. Slice 2 only
    // produces active/paused; `error` is reached by pull failures in Slice 3.
    // The CHECK constraint is added separately in 1000000000011_feeds_add_constraints.
    status: {
      type: 'text',
      notNull: true,
      default: pgm.func("'active'"),
    },
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
}
