import type {MigrationBuilder} from 'node-pg-migrate';

// The raw confirmation token is never stored; only its hash. A row links one
// token to one User, expires, and is consumed at most once (Slice 1.2 enforces
// single-use via consumed_at).

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('email_confirmation_tokens', {
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
    token_hash: {type: 'text', notNull: true},
    expires_at: {type: 'timestamptz', notNull: true},
    consumed_at: {type: 'timestamptz'},
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('email_confirmation_tokens', 'user_id', {
    name: 'email_confirmation_tokens_user_id_idx',
  });
}
