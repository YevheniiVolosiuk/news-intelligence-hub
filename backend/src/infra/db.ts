import {Pool} from 'pg';

/**
 * Builds the Postgres connection string from env. A full DATABASE_URL wins;
 * otherwise it is assembled from parts so every value stays env-configurable.
 */
export function databaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const user = process.env.DB_USER ?? 'nih';
  const password = process.env.DB_PASSWORD ?? '';
  const host = process.env.DB_HOST ?? 'db';
  const port = process.env.DB_PORT ?? '5432';
  const name = process.env.DB_NAME ?? 'nih';
  return `postgres://${user}:${password}@${host}:${port}/${name}`;
}

/** Creates a pooled Postgres client. */
export function createPool(): Pool {
  return new Pool({connectionString: databaseUrl()});
}
