/**
 * The one network-touching seam in the Feeds slice. Validating an RSS/Atom URL
 * means a real fetch + parse, so it is isolated behind an injected interface
 * exactly like CONFIRMATION_LINK_NOTIFIER: production binds a real probe, while
 * E2E/unit tests override the token with a deterministic double.
 */
export type FeedValidationResult =
  | {ok: true; title?: string; sourceUrl: string}
  | {ok: false; reason: 'malformed' | 'unreachable' | 'not-a-feed' | 'timeout'};

export interface FeedValidator {
  validate(url: string): Promise<FeedValidationResult>;
}

/** Nest DI token for the validator seam. */
export const FEED_VALIDATOR = Symbol('FeedValidator');
