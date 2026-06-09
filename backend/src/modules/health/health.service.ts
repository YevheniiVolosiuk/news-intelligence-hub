import {Injectable, Logger, OnModuleDestroy} from '@nestjs/common';
import {Pool} from 'pg';
import {Redis} from 'ioredis';
import {createPool} from '../../infra/database/db';
import {createRedis} from '../../infra/cache/redis';

interface DependencyStatus {
  ok: boolean;
  error?: string;
}

export interface HealthReport {
  ok: boolean;
  service: 'backend';
  checks: {db: DependencyStatus; redis: DependencyStatus};
  ts: number;
}

/**
 * Liveness/readiness for the API. Confirms the two backing services the whole
 * stack depends on - Postgres and Redis - are actually reachable, not just that
 * the Node process is up.
 */
@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private readonly pool: Pool = createPool();
  private readonly redis: Redis = createRedis();

  async check(): Promise<HealthReport> {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    return {
      ok: db.ok && redis.ok,
      service: 'backend',
      checks: {db, redis},
      ts: Math.floor(Date.now() / 1000),
    };
  }

  private async checkDb(): Promise<DependencyStatus> {
    try {
      await this.pool.query('SELECT 1');
      return {ok: true};
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`db health check failed: ${error}`);
      return {ok: false, error};
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    try {
      const pong = await this.redis.ping();
      return {ok: pong === 'PONG'};
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`redis health check failed: ${error}`);
      return {ok: false, error};
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end().catch(() => undefined);
    this.redis.disconnect();
  }
}
