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
  const backendRoot = path.join(__dirname, '..', '..');
  const cli = path.join(backendRoot, 'node_modules', '.bin', 'node-pg-migrate');

  await execFileAsync(
    cli,
    ['-j', 'sql', '--migrations-dir', 'migrations', 'up'],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrlOverride ?? databaseUrl(),
      },
    },
  );
}
