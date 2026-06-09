import IORedis, {Redis, RedisOptions} from 'ioredis';

/**
 * Builds the Redis connection string from env. A full REDIS_URL wins; otherwise
 * it is assembled from host/port parts so every value stays configurable via env.
 */
export function redisUrl(): string {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  const host = process.env.REDIS_HOST ?? 'redis';
  const port = process.env.REDIS_PORT ?? '6379';
  return `redis://${host}:${port}/0`;
}

/**
 * Connection options for BullMQ. We pass a plain options object (not a shared
 * ioredis instance) so BullMQ owns its own blocking connection and sets the
 * required `maxRetriesPerRequest: null` itself. This also sidesteps the
 * dual-ioredis-version type hazard between this package and BullMQ's bundled copy.
 */
export function redisConnectionOptions(): RedisOptions {
  const url = new URL(redisUrl());
  const db = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: Number.isNaN(db) ? 0 : db,
    username: url.username || undefined,
    password: url.password || undefined,
  };
}

/**
 * Creates a standalone ioredis client (used by the health check for a direct
 * PING). `maxRetriesPerRequest: null` keeps a stalled Redis from throwing on
 * every queued command.
 */
export function createRedis(): Redis {
  return new IORedis(redisUrl(), {maxRetriesPerRequest: null});
}
