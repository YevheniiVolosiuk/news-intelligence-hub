-- Up Migration

-- A Feed is a User's subscription to one RSS/Atom URL (CONTEXT.md). Tenancy is a
-- data-layer concern: every Feed belongs to exactly one User and is only ever
-- read/mutated through `WHERE id = $1 AND user_id = $2` (the Slice 1 primitive).
CREATE TABLE feeds (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE is intentional: a Feed is a User's private subscription
  -- (it has no meaning without its owner), so deleting a User removes that
  -- User's Feeds. This is the *opposite* of the Article -> Feed rule below and
  -- in ADR-0001: deleting a Feed must DETACH shared Articles (ON DELETE SET
  -- NULL), never cascade them away. Owned subscription => cascade; shared
  -- content => detach.
  user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  url            text NOT NULL,
  -- Normalised form (lowercased host, no trailing slash) backing the per-User
  -- uniqueness rule. The raw `url` is kept for display.
  normalised_url text NOT NULL,
  title          text,
  -- Feed status vocabulary is fixed: active | paused | error. Slice 2 only
  -- produces active/paused; `error` is reached by pull failures in Slice 3.
  status         text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'paused', 'error')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- Feeds are per-User; a Source is shared (US-17). Two Users may each hold a
  -- Feed for the same URL, but one User cannot hold the same URL twice.
  CONSTRAINT feeds_user_url_unique UNIQUE (user_id, normalised_url)
);

CREATE INDEX feeds_user_id_idx ON feeds (user_id);

-- Forward-looking schema decision (ADR-0001, realised in Slice 3): when the
-- Articles table arrives, the Article -> Feed reference must be nullable /
-- ON DELETE SET NULL so deleting a Feed *detaches* its Articles rather than
-- cascade-deleting them. No Articles exist yet in this slice.

-- Down Migration

DROP TABLE feeds;
