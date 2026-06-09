import path from 'path';
import {execFile} from 'child_process';
import {promisify} from 'util';
import {databaseUrl} from './db';

const execFileAsync = promisify(execFile);

/**
 * Applies all pending migrations against the given database. Runs the
 * node-pg-migrate CLI in a child process rather than importing it: the package
 * is ESM-only and would not load under the CommonJS test runtime, and shelling
 * out keeps startup, `npm run migrate`, and the e2e harness on one code path.
 * Used both at API startup and by the harness against its disposable Postgres,
 * so the schema a test runs on is exactly the schema production gets.
 */
export async function runMigrations(
  databaseUrlOverride?: string,
): Promise<void> {
  // Anchor on the working directory, not __dirname: the latter is src/infra
  // under ts-jest but dist/infra in the built image, which would point the CLI
  // lookup at the wrong tree. cwd is the backend root in both contexts.
  const backendRoot = process.cwd();
  const cli = path.join(backendRoot, 'node_modules', '.bin', 'node-pg-migrate');

  await execFileAsync(
    cli,
    ['-j', 'sql', '--migrations-dir', 'src/infra/database/migrations', 'up'],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrlOverride ?? databaseUrl(),
      },
    },
  );
}
