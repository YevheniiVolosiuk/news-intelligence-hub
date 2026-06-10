import {Inject, Injectable} from '@nestjs/common';
import {DatabaseError, Pool} from 'pg';
import {PG_POOL} from '../../infra/database/database.module';

export type FeedStatus = 'active' | 'paused' | 'error';

export interface FeedRow {
  id: string;
  url: string;
  title: string | null;
  status: FeedStatus;
  last_pulled_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Thrown when a User adds a URL they already hold — the per-User unique index. */
export class FeedAlreadyExistsError extends Error {
  constructor() {
    super('feed already exists for this user');
    this.name = 'FeedAlreadyExistsError';
  }
}

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

/**
 * Raw-SQL data access for Feeds. Tenancy travels with the queries: every read
 * and mutation is scoped by `user_id` (the Slice 1 primitive), so no Feed is
 * ever reachable by primary key alone.
 */
@Injectable()
export class FeedsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(
    userId: string,
    url: string,
    normalisedUrl: string,
    title: string | null,
  ): Promise<FeedRow> {
    try {
      const {rows} = await this.pool.query<FeedRow>(
        `INSERT INTO feeds (user_id, url, normalised_url, title)
         VALUES ($1, $2, $3, $4)
         RETURNING id, url, title, status, last_pulled_at, last_error, created_at, updated_at`,
        [userId, url, normalisedUrl, title],
      );
      return rows[0];
    } catch (err) {
      if (err instanceof DatabaseError && err.code === UNIQUE_VIOLATION) {
        throw new FeedAlreadyExistsError();
      }
      throw err;
    }
  }

  /**
   * Sets the status of the caller's own Feed and returns the updated row.
   * Scoped by `user_id`, so a Feed that isn't the caller's matches no row and
   * yields `null` — indistinguishable from a nonexistent id (non-enumerating).
   */
  async setStatus(
    userId: string,
    feedId: string,
    status: FeedStatus,
  ): Promise<FeedRow | null> {
    const {rows} = await this.pool.query<FeedRow>(
      `UPDATE feeds
          SET status = $3, updated_at = now()
        WHERE id = $2 AND user_id = $1
      RETURNING id, url, title, status, last_pulled_at, last_error, created_at, updated_at`,
      [userId, feedId, status],
    );
    return rows[0] ?? null;
  }

  /**
   * Deletes the caller's own Feed and reports whether a row was removed.
   * Scoped by `user_id`, so a Feed that isn't the caller's matches no row and
   * yields `false` — indistinguishable from a nonexistent id (non-enumerating).
   * Per ADR-0001, the future Article -> Feed link is `ON DELETE SET NULL`, so
   * this deletion detaches Articles rather than cascading them away.
   */
  async deleteForUser(userId: string, feedId: string): Promise<boolean> {
    const {rowCount} = await this.pool.query(
      `DELETE FROM feeds WHERE id = $2 AND user_id = $1`,
      [userId, feedId],
    );
    return (rowCount ?? 0) > 0;
  }

  /** Lists the caller's own Feeds, newest first. Scoped strictly to `user_id`. */
  async listForUser(userId: string): Promise<FeedRow[]> {
    const {rows} = await this.pool.query<FeedRow>(
      `SELECT id, url, title, status, last_pulled_at, last_error, created_at, updated_at
         FROM feeds
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId],
    );
    return rows;
  }

  /**
   * Find a feed by ID (system-level, no tenant scoping).
   * Used by the ingestion worker which operates outside of user context.
   */
  async findById(feedId: string): Promise<FeedRow | null> {
    const {rows} = await this.pool.query<FeedRow>(
      `SELECT id, url, title, status, last_pulled_at, last_error, created_at, updated_at
         FROM feeds
        WHERE id = $1`,
      [feedId],
    );
    return rows[0] ?? null;
  }

  /** Mark a feed as successfully pulled (active + timestamp). */
  async updatePullSuccess(feedId: string): Promise<void> {
    await this.pool.query(
      `UPDATE feeds
          SET status = 'active', last_pulled_at = now(), last_error = NULL, updated_at = now()
        WHERE id = $1`,
      [feedId],
    );
  }

  /** Mark a feed as errored with a message. */
  async updatePullError(feedId: string, error: string): Promise<void> {
    await this.pool.query(
      `UPDATE feeds
          SET status = 'error', last_error = $2, updated_at = now()
        WHERE id = $1`,
      [feedId, error],
    );
  }
}
