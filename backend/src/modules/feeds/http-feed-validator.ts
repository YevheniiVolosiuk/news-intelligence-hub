import {Injectable, Logger} from '@nestjs/common';
import {FeedValidationResult, FeedValidator} from './feed-validator';

/** The slice of the global `fetch` contract this probe relies on. */
export type FetchFn = (
  url: string,
  init: {signal: AbortSignal},
) => Promise<{
  ok: boolean;
  status: number;
  headers: {get(name: string): string | null};
  text(): Promise<string>;
}>;

/**
 * Production FeedValidator binding. Checks URL well-formedness first (no
 * network), then probes the source over HTTP with a bounded timeout and a
 * lightweight RSS/Atom sniff, producing the full
 * `malformed | unreachable | not-a-feed | timeout` failure matrix. The network
 * call is taken as a constructor dependency (defaulting to the global `fetch`)
 * so tests can drive every outcome hermetically without real network.
 */
@Injectable()
export class HttpFeedValidator implements FeedValidator {
  private readonly logger = new Logger(HttpFeedValidator.name);

  constructor(
    private readonly fetchFn: FetchFn = fetch,
    private readonly timeoutMs = Number(
      process.env.FEED_VALIDATOR_TIMEOUT_MS ?? 5000,
    ),
  ) {}

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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(parsed.toString(), {
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.log(
          `validate outcome=unreachable status=${res.status} host=${parsed.host}`,
        );
        return {ok: false, reason: 'unreachable'};
      }
      const contentType = res.headers.get('content-type') ?? '';
      const body = await res.text();
      if (looksLikeFeed(contentType, body)) {
        this.logger.log(`validate outcome=ok host=${parsed.host}`);
        return {ok: true, sourceUrl: parsed.toString()};
      }
      this.logger.log(`validate outcome=not-a-feed host=${parsed.host}`);
      return {ok: false, reason: 'not-a-feed'};
    } catch {
      const reason = controller.signal.aborted ? 'timeout' : 'unreachable';
      this.logger.log(`validate outcome=${reason} host=${parsed.host}`);
      return {ok: false, reason};
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Markers that identify an RSS, Atom, or RDF feed root. */
const FEED_BODY_MARKERS = ['<rss', '<feed', '<rdf:rdf'];
const FEED_CONTENT_TYPES = ['xml', 'rss', 'atom'];

/**
 * Lightweight RSS/Atom sniff: trust an XML/feed content-type, otherwise look for
 * a feed root element near the start of the body. Full RSS/Atom parsing lands in
 * Slice 3; this only needs to tell a feed apart from an HTML page or other noise.
 */
function looksLikeFeed(contentType: string, body: string): boolean {
  const ct = contentType.toLowerCase();
  if (FEED_CONTENT_TYPES.some(t => ct.includes(t))) return true;
  const head = body.slice(0, 1000).toLowerCase();
  return FEED_BODY_MARKERS.some(marker => head.includes(marker));
}
