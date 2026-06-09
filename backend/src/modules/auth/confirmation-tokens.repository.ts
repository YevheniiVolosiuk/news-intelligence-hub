import {Inject, Injectable} from '@nestjs/common';
import {Pool} from 'pg';
import {PG_POOL} from '../../infra/database/database.module';

export interface TokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
}

/** Raw-SQL data access for email confirmation tokens. Stores only the hash. */
@Injectable()
export class ConfirmationTokensRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO email_confirmation_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  }

  async findByHash(tokenHash: string): Promise<TokenRow | null> {
    const {rows} = await this.pool.query<TokenRow>(
      `SELECT id, user_id, token_hash, expires_at, consumed_at, created_at
         FROM email_confirmation_tokens
        WHERE token_hash = $1`,
      [tokenHash],
    );
    return rows[0] ?? null;
  }

  async consume(tokenId: string): Promise<void> {
    await this.pool.query(
      'UPDATE email_confirmation_tokens SET consumed_at = now() WHERE id = $1',
      [tokenId],
    );
  }

  /** Delete all unconsumed tokens for a user so old links return "invalid". */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM email_confirmation_tokens
        WHERE user_id = $1 AND consumed_at IS NULL`,
      [userId],
    );
  }
}
