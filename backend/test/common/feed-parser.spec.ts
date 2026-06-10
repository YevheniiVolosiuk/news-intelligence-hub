import {parseFeed} from '../../src/common/utils/feed-parser';

describe('parseFeed', () => {
  // ── RSS 2.0 ────────────────────────────────────────────────────

  it('parses an RSS 2.0 feed into normalised items', () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Tech News</title>
    <link>https://example.com</link>
    <item>
      <title>AI Breakthrough</title>
      <link>https://example.com/ai-breakthrough</link>
      <description>New model achieves state-of-the-art results.</description>
      <pubDate>Mon, 09 Jun 2025 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Cloud Update</title>
      <link>https://example.com/cloud-update</link>
      <description>Major cloud provider announces new regions.</description>
      <pubDate>Tue, 10 Jun 2025 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

    const result = parseFeed(rss);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.sourceTitle).toBe('Tech News');
    expect(result.items).toHaveLength(2);

    const first = result.items[0];
    expect(first.title).toBe('AI Breakthrough');
    expect(first.link).toBe('https://example.com/ai-breakthrough');
    expect(first.content).toBe('New model achieves state-of-the-art results.');
    expect(first.publishedAt).toBe('2025-06-09T10:00:00.000Z');
  });

  // ── Atom ────────────────────────────────────────────────────────

  it('parses an Atom feed into normalised items', () => {
    const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Dev Blog</title>
  <link href="https://dev.example.com"/>
  <entry>
    <title>Rust 2.0 Released</title>
    <link href="https://dev.example.com/rust-2"/>
    <content type="html">&lt;p&gt;Major performance improvements.&lt;/p&gt;</content>
    <published>2025-06-08T08:00:00Z</published>
  </entry>
</feed>`;

    const result = parseFeed(atom);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.sourceTitle).toBe('Dev Blog');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Rust 2.0 Released');
    expect(result.items[0].link).toBe('https://dev.example.com/rust-2');
    expect(result.items[0].publishedAt).toBe('2025-06-08T08:00:00.000Z');
  });

  // ── RDF ─────────────────────────────────────────────────────────

  it('parses an RDF (RSS 1.0) feed into normalised items', () => {
    const rdf = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns="http://purl.org/rss/1.0/">
  <channel>
    <title>Science Feed</title>
    <link>https://science.example.com</link>
  </channel>
  <item>
    <title>Mars Discovery</title>
    <link>https://science.example.com/mars</link>
    <description>Water found on Mars surface.</description>
  </item>
</rdf:RDF>`;

    const result = parseFeed(rdf);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.sourceTitle).toBe('Science Feed');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Mars Discovery');
    expect(result.items[0].link).toBe('https://science.example.com/mars');
    expect(result.items[0].content).toBe('Water found on Mars surface.');
  });

  // ── Malformed XML ───────────────────────────────────────────────

  it('returns a typed failure for malformed XML', () => {
    const result = parseFeed('<not-valid-xml><broken>');

    expect(result).toEqual({ok: false, reason: 'malformed-xml'});
  });

  // ── Non-feed document ───────────────────────────────────────────

  it('returns a typed failure for a well-formed HTML document', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Not a feed</title></head>
<body><h1>Hello</h1></body>
</html>`;

    const result = parseFeed(html);

    expect(result).toEqual({ok: false, reason: 'not-a-feed'});
  });

  // ── Edge cases ──────────────────────────────────────────────────

  it('handles a single-item feed (item is not naturally an array)', () => {
    const rss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Solo</title>
    <link>https://solo.example.com</link>
    <item>
      <title>Only Post</title>
      <link>https://solo.example.com/only</link>
      <description>Just one.</description>
    </item>
  </channel>
</rss>`;

    const result = parseFeed(rss);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(1);
  });

  it('handles missing optional fields gracefully', () => {
    const rss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Minimal</title>
    <link>https://min.example.com</link>
    <item>
      <title>No Link No Date</title>
      <description>Content here.</description>
    </item>
  </channel>
</rss>`;

    const result = parseFeed(rss);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const item = result.items[0];
    expect(item.title).toBe('No Link No Date');
    expect(item.link).toBe('');
    expect(item.publishedAt).toBeNull();
  });
});
