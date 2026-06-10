/**
 * CLI entry point: `npm run seed:demo`
 *
 * Reads DATABASE_URL from env, ensures migrations are applied, then runs
 * the demo-data seed.  This is NOT wired into app startup (Slice 11).
 */
import {Pool} from 'pg';
import {databaseUrl} from './db';
import {runMigrations} from './migrate';
import {seedDemoData} from './seeders/database.seeder';

async function main(): Promise<void> {
  const url = databaseUrl();
  console.log('Applying migrations…');
  await runMigrations(url);

  const pool = new Pool({connectionString: url});
  try {
    console.log('Seeding demo data…');
    const result = await seedDemoData(pool);
    console.log(`✓ Demo user:    ${result.user.email}`);
    console.log(`✓ Feeds:        ${result.feeds.length}`);
    console.log(`✓ Sources:      ${result.sources.length}`);
    console.log(`✓ Articles:     ${result.articles.length}`);
    const pending = result.articles.filter(a => a.processingState === 'pending').length;
    const filtered = result.articles.filter(a => a.processingState === 'filtered').length;
    console.log(`  (${pending} pending, ${filtered} filtered)`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
