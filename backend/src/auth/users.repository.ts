import {Inject, Injectable} from '@nestjs/common';
import {DatabaseError, Pool} from 'pg';
import {PG_POOL} from '../infra/database.module';

export interface UserRow {
  id: string;
  email: string;
  confirmed_at: Date | null;
}

/** Thrown when a registration collides with an existing email at the DB constraint. */
export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('email already registered');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

/** Raw-SQL data access for Users. Tenancy/isolation rules live with the queries. */
@Injectable()
export class UsersRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Inserts a new (unconfirmed) User. Email uniqueness is a DB constraint, so a
   * duplicate surfaces as a unique-violation here rather than via a racy
   * pre-check.
   */
  async markConfirmed(userId: string): Promise<UserRow> {
    const {rows} = await this.pool.query<UserRow>(
      `UPDATE users SET confirmed_at = now(), updated_at = now()
        WHERE id = $1
       RETURNING id, email, confirmed_at`,
      [userId],
    );
    return rows[0];
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const {rows} = await this.pool.query<UserRow>(
      'SELECT id, email, confirmed_at FROM users WHERE email = $1',
      [email],
    );
    return rows[0] ?? null;
  }

  async getPasswordHash(userId: string): Promise<string> {
    const {rows} = await this.pool.query<{password_hash: string}>(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId],
    );
    return rows[0].password_hash;
  }

  async create(email: string, passwordHash: string): Promise<UserRow> {
    try {
      const {rows} = await this.pool.query<UserRow>(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         RETURNING id, email, confirmed_at`,
        [email, passwordHash],
      );
      return rows[0];
    } catch (err) {
      if (err instanceof DatabaseError && err.code === UNIQUE_VIOLATION) {
        throw new EmailAlreadyRegisteredError();
      }
      throw err;
    }
  }
}
