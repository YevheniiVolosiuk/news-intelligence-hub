import {
  FeedFetcher,
  FeedFetchResult,
} from '../../src/modules/ingestion/feed-fetcher';

export class StubFeedFetcher implements FeedFetcher {
  private readonly results = new Map<string, FeedFetchResult>();

  set(url: string, result: FeedFetchResult): void {
    this.results.set(url, result);
  }

  clear(): void {
    this.results.clear();
  }

  async fetch(url: string): Promise<FeedFetchResult> {
    const result = this.results.get(url);
    if (result) return result;
    return {ok: false, reason: 'unreachable'};
  }
}
