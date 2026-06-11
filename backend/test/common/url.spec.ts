import {normaliseUrl} from '../../src/common/utils/url';

describe('normaliseUrl', () => {
  it('lowercases the host', () => {
    expect(normaliseUrl('https://Example.COM/feed')).toBe(
      'https://example.com/feed',
    );
  });

  it('strips a trailing slash', () => {
    expect(normaliseUrl('https://example.com/feed/')).toBe(
      'https://example.com/feed',
    );
  });

  it('trailing-slash and host-case variants normalise identically', () => {
    const a = normaliseUrl('https://Example.COM/feed/');
    const b = normaliseUrl('https://example.com/feed');
    expect(a).toBe(b);
  });

  it('trims whitespace', () => {
    expect(normaliseUrl('  https://example.com/feed  ')).toBe(
      'https://example.com/feed',
    );
  });

  it('returns trimmed lowercase on unparseable input', () => {
    expect(normaliseUrl('  NOT-A-URL  ')).toBe('not-a-url');
  });

  it('preserves query strings and fragments', () => {
    expect(normaliseUrl('https://Example.COM/feed?utm_source=x#section')).toBe(
      'https://example.com/feed?utm_source=x#section',
    );
  });
});
