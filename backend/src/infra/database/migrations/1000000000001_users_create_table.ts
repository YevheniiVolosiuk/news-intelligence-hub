import type {MigrationBuilder} from 'node-pg-migrate';

// citext gives us case-insensitive email uniqueness at the data layer, so two
// registrations differing only in case collide on the DB constraint (Principle 4:
// isolation enforced by the data layer, not the handler).

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createExtension('citext', {ifNotExists: true});
  pgm.createExtension('pgcrypto', {ifNotExists: true});

  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    email: {type: 'citext', notNull: true},
    password_hash: {type: 'text', notNull: true},
    confirmed_at: {type: 'timestamptz'},
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
  pgm.addConstraint('users', 'users_email_unique', {
    unique: ['email'],
  });
}
