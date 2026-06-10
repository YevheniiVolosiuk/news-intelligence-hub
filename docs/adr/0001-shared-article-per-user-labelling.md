# Shared raw Articles, per-User Labelling

Articles, Entities, and Mentions are stored once and shared across Users; Labelling
(summary, importance, entity/category/axis assignments) and the visible Graph are
per-User. We chose this because the same article often arrives for many Users, and
reprocessing it per User would multiply LLM cost — but categories, axes, and importance
are User-specific, so labelling cannot be shared. Isolation is therefore enforced at the
Labelling and Graph layer, not by duplicating raw Article rows: any read path must scope
by User, and a direct-ID request for raw Article data must still be gated by whether the
User has a Feed or Labelling linking to it.

Trade-off: large LLM/storage savings and natural deduplication, bought at the price of a
subtler isolation model that must be proven correct at every read path rather than falling
out of physical row separation. Maps to Principle 4 (multi-tenant isolation).

## Note: cascade policies differ by ownership

This sharing model produces two deliberately *opposite* delete policies, which should not
be conflated:

- **Feed → User is `ON DELETE CASCADE`** (`feeds.user_id`, the Slice 2 migration). A Feed is
  a User's private subscription with no meaning apart from its owner, so deleting a User
  removes that User's Feeds.
- **Article → Feed must be `ON DELETE SET NULL`** (realised in Slice 3). Articles are shared
  raw content per the decision above; deleting a Feed must *detach* its Articles, never
  cascade-delete them, or one User's unsubscribe would destroy data other Users still rely
  on.

Rule of thumb: owned/private rows cascade with their owner; shared rows detach.
