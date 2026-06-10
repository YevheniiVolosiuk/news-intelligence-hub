import {Injectable, Logger} from '@nestjs/common';
import {FeedFetcher, FeedFetchResult} from './feed-fetcher';

/**
 * Narrow slice of the global `fetch` contract, extracted so tests can
 * inject a deterministic double without touching the network.
 */
export type FetchFn = (
  url: string,
  init: {signal: AbortSignal},
) => Promise<{
  ok: boolean;
  status: number;
  headers: {get(name: string): string | null};
  text(): Promise<string>;
}>;

@Injectable()
export class HttpFeedFetcher implements FeedFetcher {
  private readonly logger = new Logger(HttpFeedFetcher.name);
  private readonly fetchFn: FetchFn;
  private readonly timeoutMs: number;

  constructor(fetchFn: FetchFn = fetch as FetchFn) {
    this.fetchFn = fetchFn;
    this.timeoutMs = Number(
      process.env.FEED_FETCHER_TIMEOUT_MS ??
        process.env.FEED_VALIDATOR_TIMEOUT_MS ??
        5000,
    );
  }

  async fetch(url: string): Promise<FeedFetchResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchFn(url, {signal: controller.signal});
      if (!res.ok) {
        this.logger.log(
          `fetch outcome=unreachable status=${res.status} host=${new URL(url).hostname}`,
        );
        return {ok: false, reason: 'unreachable'};
      }

      const body = await res.text();
      const contentType = res.headers.get('content-type') ?? '';
      this.logger.log(
        `fetch outcome=ok host=${new URL(url).hostname} bytes=${body.length}`,
      );
      return {ok: true, body, contentType};
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const reason = isAbort ? 'timeout' as const : 'unreachable' as const;
      this.logger.log(
        `fetch outcome=${reason} host=${new URL(url).hostname}`,
      );
      return {ok: false, reason};
    } finally {
      clearTimeout(timer);
    }
  }
}
