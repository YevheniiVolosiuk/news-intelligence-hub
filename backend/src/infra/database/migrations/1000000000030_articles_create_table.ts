import type {MigrationBuilder} from 'node-pg-migrate';

// An Article is the shared raw source material pulled from a Feed (CONTEXT.md):
// stored once and reused across Users per ADR-0001. It carries no Importance,
// categories, or axis values of its own -- those are per-User and live on the
// Labelling (a later slice).

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('articles', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    source_id: {
      type: 'uuid',
      notNull: true,
      references: 'sources',
    },
    // feed_id records the provenance of the originating Feed. ON DELETE SET NULL
    // *detaches* shared Articles when a Feed is deleted -- it must never cascade
    // them away, or one User's unsubscribe would destroy data other Users still
    // rely on (ADR-0001; the opposite of feeds.user_id's ON DELETE CASCADE).
    feed_id: {
      type: 'uuid',
      references: 'feeds',
      onDelete: 'SET NULL',
    },
    url: {type: 'text', notNull: true},
    normalised_url: {type: 'text', notNull: true},
    content_hash: {type: 'text'},
    title: {type: 'text'},
    content: {type: 'text'},
    published_at: {type: 'timestamptz'},
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
