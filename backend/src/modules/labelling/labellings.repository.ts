import {Inject, Injectable} from '@nestjs/common';
import {Pool} from 'pg';
import {PG_POOL} from '../../infra/database/database.module';

export interface UpsertLabellingParams {
  userId: string;
  articleId: string;
  summary: string;
  importance: string;
  entities: unknown;
  model: string;
  promptVersion: string;
}

@Injectable()
export class LabellingsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Write the Labelling for a (User, Article) pair, overwriting any prior one.
   * The `ON CONFLICT (user_id, article_id)` clause is what makes re-running a
   * label job idempotent: a second run updates the existing row rather than
   * stacking a duplicate (the table's unique key from Slice 4.1).
   */
  async upsert(params: UpsertLabellingParams): Promise<void> {
    await this.pool.query(
      `INSERT INTO labellings
         (user_id, article_id, summary, importance, entities, model, prompt_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, article_id) DO UPDATE SET
         summary = EXCLUDED.summary,
         importance = EXCLUDED.importance,
         entities = EXCLUDED.entities,
         model = EXCLUDED.model,
         prompt_version = EXCLUDED.prompt_version`,
      [
        params.userId,
        params.articleId,
        params.summary,
        params.importance,
        JSON.stringify(params.entities),
        params.model,
        params.promptVersion,
      ],
    );
  }
}
