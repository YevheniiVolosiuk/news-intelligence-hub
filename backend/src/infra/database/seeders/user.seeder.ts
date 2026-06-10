import {Pool} from 'pg';

export interface SeededUser {
  id: string;
  email: string;
}

const DEMO_EMAIL = 'demo@example.com';

/**
 * Deterministic password hash for the demo user.
 *
 * The seed bypasses AuthService registration to stay standalone (no Nest
 * DI, no argon2 dependency at seed time). This hash was pre-computed with
 * argon2 for the literal string "demo-password" — the reviewer can log in
 * with that password.
 *
 * Generated via: node -e "require('argon2').hash('demo-password').then(console.log)"
 */
const DEMO_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$8g4nTdvHWzynLSJ3ZmjDZg$PTrWdFw1mLKcAkzo0qYqLUb/ox9hrB6BpuYjbQ2RI1A';

/**
 * Upsert the demo user. On conflict (email already exists) the existing row
 * is returned and `confirmed_at` is refreshed so the user stays usable.
 */
export async function seedDemoUser(pool: Pool): Promise<SeededUser> {
  const {rows} = await pool.query<{id: string; email: string}>(
    `INSERT INTO users (email, password_hash, confirmed_at)
     VALUES ($1, $2, now())
     ON CONFLICT (email) DO UPDATE SET confirmed_at = now()
     RETURNING id, email`,
    [DEMO_EMAIL, DEMO_PASSWORD_HASH],
  );
  return rows[0];
}
