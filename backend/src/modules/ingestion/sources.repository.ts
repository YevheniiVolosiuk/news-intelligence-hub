import {Inject, Injectable} from '@nestjs/common';
import {Pool} from 'pg';
import {PG_POOL} from '../../infra/database/database.module';

export interface SourceRow {
  id: string;
  normalised_host: string;
  title: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class SourcesRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Find or create a Source by its normalised host.
   * Two feeds at the same host collapse to one source row (ADR-0001).
   */
  async findOrCreate(normalisedHost: string, title: string | null): Promise<SourceRow> {
    const {rows} = await this.pool.query<SourceRow>(
      `INSERT INTO sources (normalised_host, title)
       VALUES ($1, $2)
       ON CONFLICT (normalised_host) DO UPDATE SET title = COALESCE(sources.title, EXCLUDED.title)
       RETURNING id, normalised_host, title, created_at, updated_at`,
      [normalisedHost, title],
    );
    return rows[0];
  }
}
