import type {MigrationBuilder} from 'node-pg-migrate';

// A Labelling is the LLM-generated, per-User analysis of an Article: summary,
// Importance, extracted Entities, and (later) Category/axis assignments
// (CONTEXT.md). Never shared across Users -- this is what multi-tenant isolation
// protects (ADR-0001). Both foreign keys cascade: a Labelling is an owned,
// private row with no meaning apart from its (User, Article) pair, so it dies
// with either parent. That is the *opposite* of the shared Article -> Feed
// detach rule -- owned rows cascade, shared rows detach.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('labellings', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    article_id: {
      type: 'uuid',
      notNull: true,
      references: 'articles',
      onDelete: 'CASCADE',
    },
    summary: {type: 'text', notNull: true},
    // Importance is the LLM's verdict: important | normal | junk. The closed
    // vocabulary belongs to the labelling domain slice that first writes it;
    // this data-spine slice stores it without a CHECK.
    importance: {type: 'text', notNull: true},
    // entities holds the raw extracted [{name, type}] list. categories and
    // axis_values stay empty until Slice 6 introduces those assignments.
    entities: {type: 'jsonb', notNull: true, default: '[]'},
    categories: {type: 'jsonb', notNull: true, default: '[]'},
    axis_values: {type: 'jsonb', notNull: true, default: '[]'},
    model: {type: 'text', notNull: true},
    prompt_version: {type: 'text', notNull: true},
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // The idempotent upsert key: a re-label of the same Article for the same User
  // overwrites rather than stacking a second Labelling. One Article has at most
  // one Labelling per User.
  pgm.addConstraint('labellings', 'labellings_user_article_unique', {
    unique: ['user_id', 'article_id'],
  });
}
