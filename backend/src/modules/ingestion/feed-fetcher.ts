/**
 * Injectable seam for fetching a Feed's document over HTTP.
 *
 * Mirrors the FeedValidator pattern: injectable interface + DI token,
 * production HttpFeedFetcher, StubFeedFetcher in tests.
 */

export type FeedFetchResult =
  | {ok: true; body: string; contentType: string}
  | {ok: false; reason: 'unreachable' | 'timeout'};

export interface FeedFetcher {
  fetch(url: string): Promise<FeedFetchResult>;
}

export const FEED_FETCHER = Symbol('FeedFetcher');
