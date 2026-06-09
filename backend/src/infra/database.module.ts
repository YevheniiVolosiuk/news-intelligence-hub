import {Global, Module, OnModuleDestroy, Inject} from '@nestjs/common';
import {Pool} from 'pg';
import {createPool} from './db';

/** DI token for the shared Postgres pool. */
export const PG_POOL = Symbol('PG_POOL');

/**
 * Provides one shared Postgres pool to the whole app. Global so every slice's
 * repositories inject the same pool rather than each opening its own.
 */
@Global()
@Module({
  providers: [{provide: PG_POOL, useFactory: () => createPool()}],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end().catch(() => undefined);
  }
}
