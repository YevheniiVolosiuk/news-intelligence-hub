import {Inject, Injectable} from '@nestjs/common';
import {Pool} from 'pg';
import {PG_POOL} from '../../infra/database/database.module';

export interface ArticleRow {
  id: string;
  source_id: string;
  feed_id: string | null;
  url: string;
  normalised_url: string;
  content_hash: string | null;
  title: string | null;
  content: string | null;
  published_at: Date | null;
  processing_state: string;
  filtered_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateArticleParams {
  sourceId: string;
  feedId: string;
  url: string;
  normalisedUrl: string;
  contentHash: string;
  title: string | null;
  content: string | null;
  publishedAt: Date | null;
  processingState: 'pending' | 'filtered';
  filteredReason: string | null;
}

@Injectable()
export class ArticlesRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Insert an article unless one with the same normalised_url already exists.
   * Returns the inserted row, or null if skipped (duplicate).
   */
  async createIfNotExists(
    params: CreateArticleParams,
  ): Promise<ArticleRow | null> {
    const {rows} = await this.pool.query<ArticleRow>(
      `INSERT INTO articles (
         source_id, feed_id, url, normalised_url, content_hash,
         title, content, published_at, processing_state, filtered_reason
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (normalised_url) DO NOTHING
       RETURNING *`,
      [
        params.sourceId,
        params.feedId,
        params.url,
        params.normalisedUrl,
        params.contentHash,
        params.title,
        params.content,
        params.publishedAt,
        params.processingState,
        params.filteredReason,
      ],
    );
    return rows[0] ?? null;
  }

  /**
   * Fetch a single Article by primary key (system-level, no tenant scoping) —
   * the label worker operates outside any user context. Returns null when the
   * id is unknown.
   */
  async findById(articleId: string): Promise<ArticleRow | null> {
    const {rows} = await this.pool.query<ArticleRow>(
      'SELECT * FROM articles WHERE id = $1',
      [articleId],
    );
    return rows[0] ?? null;
  }

  /** Move an Article to the `processed` terminal once it has been labelled. */
  async markProcessed(articleId: string): Promise<void> {
    await this.pool.query(
      `UPDATE articles
          SET processing_state = 'processed', updated_at = now()
        WHERE id = $1`,
      [articleId],
    );
  }
}
