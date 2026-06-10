import {Pool} from 'pg';

export interface SeededSource {
  id: string;
  normalisedHost: string;
}

interface SourceDefinition {
  normalisedHost: string;
  title: string;
}

const DEMO_SOURCES: SourceDefinition[] = [
  {normalisedHost: 'techcrunch.com', title: 'TechCrunch'},
  {normalisedHost: 'www.reuters.com', title: 'Reuters'},
  {normalisedHost: 'feeds.bbci.co.uk', title: 'BBC News'},
];

/**
 * Upsert demo sources. Mirrors SourcesRepository.findOrCreate logic:
 * ON CONFLICT keeps the first title, returns the existing row.
 */
export async function seedDemoSources(pool: Pool): Promise<SeededSource[]> {
  const sources: SeededSource[] = [];

  for (const def of DEMO_SOURCES) {
    const {rows} = await pool.query<{id: string; normalised_host: string}>(
      `INSERT INTO sources (normalised_host, title)
       VALUES ($1, $2)
       ON CONFLICT (normalised_host) DO UPDATE SET title = COALESCE(sources.title, EXCLUDED.title)
       RETURNING id, normalised_host`,
      [def.normalisedHost, def.title],
    );
    sources.push({id: rows[0].id, normalisedHost: rows[0].normalised_host});
  }

  return sources;
}
