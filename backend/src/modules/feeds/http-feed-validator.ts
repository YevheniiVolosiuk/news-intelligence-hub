import {Injectable, Logger} from '@nestjs/common';
import {FeedValidationResult, FeedValidator} from './feed-validator';

/**
 * Minimal production binding for Slice 2.1 (happy path only). It rejects URLs
 * that are not well-formed http(s) and accepts everything else, returning the
 * URL as the resolved Source. The real fetch + RSS/Atom parse + bounded
 * reachability probe — and the full `unreachable | not-a-feed | timeout`
 * failure matrix — land behind this same seam in the rejection slice (2.2) and
 * the pull worker (Slice 3); only this class changes, never its callers.
 */
@Injectable()
export class HttpFeedValidator implements FeedValidator {
  private readonly logger = new Logger(HttpFeedValidator.name);

  async validate(url: string): Promise<FeedValidationResult> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      this.logger.log('validate outcome=malformed');
      return {ok: false, reason: 'malformed'};
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      this.logger.log(`validate outcome=malformed protocol=${parsed.protocol}`);
      return {ok: false, reason: 'malformed'};
    }

    this.logger.log(`validate outcome=ok host=${parsed.host}`);
    return {ok: true, sourceUrl: parsed.toString()};
  }
}
