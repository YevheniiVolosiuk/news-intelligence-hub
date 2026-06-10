import {Pool} from 'pg';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {runMigrations} from '../../src/infra/database/migrate';

export interface MigrationHarness {
  pool: Pool;
  close: () => Promise<void>;
}

/**
 * Boots a disposable Postgres (Testcontainers), applies all migrations, and
 * exposes a raw pg Pool. Unlike the e2e harness this does not boot the Nest
 * app: a data-layer slice is proven at the SQL boundary. The CLI is the same
 * code path as `npm run migrate` and the e2e harness, so the schema under
 * test is exactly the one production gets.
 */
export async function startMigrationHarness(): Promise<MigrationHarness> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:17',
  ).start();
  const databaseUrl = container.getConnectionUri();

  await runMigrations(databaseUrl);

  const pool = new Pool({connectionString: databaseUrl});

  return {
    pool,
    close: async () => {
      await pool.end().catch(() => undefined);
      await container.stop();
    },
  };
}
