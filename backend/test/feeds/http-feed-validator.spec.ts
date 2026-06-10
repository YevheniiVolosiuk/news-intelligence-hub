import {HttpFeedValidator} from '../../src/modules/feeds/http-feed-validator';

/** Builds a fake fetch Response with the subset HttpFeedValidator reads. */
function response(opts: {
  ok?: boolean;
  status?: number;
  contentType?: string;
  body?: string;
}) {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: {
      get: (name: string) =>
        name === 'content-type' ? (opts.contentType ?? null) : null,
    },
    text: () => Promise.resolve(opts.body ?? ''),
  };
}

describe('HttpFeedValidator', () => {
  it('rejects a non-http(s) URL as malformed without touching the network', async () => {
    const fetchFn = jest.fn();
    const validator = new HttpFeedValidator(fetchFn);

    const result = await validator.validate('not a url');

    expect(result).toEqual({ok: false, reason: 'malformed'});
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('accepts a reachable RSS/Atom response, returning the resolved source', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      response({
        contentType: 'application/rss+xml',
        body: '<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>',
      }),
    );
    const validator = new HttpFeedValidator(fetchFn);

    const result = await validator.validate(
      'https://blog.example.com/feed.xml',
    );

    expect(result).toEqual({
      ok: true,
      sourceUrl: 'https://blog.example.com/feed.xml',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('rejects a reachable HTML page as not-a-feed', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      response({
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><html><head><title>Home</title></head></html>',
      }),
    );
    const validator = new HttpFeedValidator(fetchFn);

    const result = await validator.validate('https://example.com');

    expect(result).toEqual({ok: false, reason: 'not-a-feed'});
  });

  it('rejects a source that fails to connect as unreachable', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    const validator = new HttpFeedValidator(fetchFn);

    const result = await validator.validate('https://does-not-resolve.example');

    expect(result).toEqual({ok: false, reason: 'unreachable'});
  });

  it('rejects a hanging source via the bounded timeout', async () => {
    // Never resolves on its own; only the validator's abort ends it.
    const fetchFn = jest.fn(
      (_url: string, init: {signal: AbortSignal}) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const validator = new HttpFeedValidator(fetchFn as never, 10);

    const result = await validator.validate('https://slow.example.com/feed');

    expect(result).toEqual({ok: false, reason: 'timeout'});
  });

  it('treats a non-2xx HTTP status as unreachable', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      response({
        ok: false,
        status: 503,
        contentType: 'text/html',
        body: 'Service Unavailable',
      }),
    );
    const validator = new HttpFeedValidator(fetchFn);

    const result = await validator.validate('https://down.example.com/feed');

    expect(result).toEqual({ok: false, reason: 'unreachable'});
  });
});
