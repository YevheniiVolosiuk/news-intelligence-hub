import type {MigrationBuilder} from 'node-pg-migrate';

// The dedup key for ingestion: a re-pull of the same URL inserts-or-skips
// rather than creating a second Article.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addConstraint('articles', 'articles_normalised_url_unique', {
    unique: ['normalised_url'],
  });
}
