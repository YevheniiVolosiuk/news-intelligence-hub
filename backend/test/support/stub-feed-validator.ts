import {
  FeedValidationResult,
  FeedValidator,
} from '../../src/modules/feeds/feed-validator';

/**
 * Deterministic FeedValidator double for E2E tests. Keeps the harness hermetic
 * (no real network) the same way CapturingConfirmationLinkNotifier replaces the
 * email seam. By default any URL is accepted as a valid feed; a test can stub a
 * specific URL to a chosen result to exercise rejection paths in later slices.
 */
export class StubFeedValidator implements FeedValidator {
  private readonly results = new Map<string, FeedValidationResult>();

  /** Force a specific result for a given URL. */
  set(url: string, result: FeedValidationResult): void {
    this.results.set(url, result);
  }

  clear(): void {
    this.results.clear();
  }

  async validate(url: string): Promise<FeedValidationResult> {
    return this.results.get(url) ?? {ok: true, sourceUrl: url};
  }
}
