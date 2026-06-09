-- Up Migration

-- citext gives us case-insensitive email uniqueness at the data layer, so two
-- registrations differing only in case collide on the DB constraint (Principle 4:
-- isolation enforced by the data layer, not the handler).
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL,
  password_hash text NOT NULL,
  confirmed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

-- The raw confirmation token is never stored; only its hash. A row links one
-- token to one User, expires, and is consumed at most once (Slice 1.2 enforces
-- single-use via consumed_at).
CREATE TABLE email_confirmation_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_confirmation_tokens_user_id_idx
  ON email_confirmation_tokens (user_id);

-- Down Migration

DROP TABLE email_confirmation_tokens;
DROP TABLE users;
