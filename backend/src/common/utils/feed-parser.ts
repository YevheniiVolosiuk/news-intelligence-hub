/**
 * Deterministic feed parser — RSS 2.0, Atom, RDF (RSS 1.0).
 *
 * Pure function: XML string → normalised items or typed failure.
 * Never throws — one bad feed cannot crash the worker.
 * No network, no DB, no queue.
 */

import {XMLParser, XMLValidator} from 'fast-xml-parser';

export interface ParsedFeedItem {
  title: string;
  link: string;
  content: string;
  publishedAt: string | null; // ISO 8601 or null
}

export interface ParseFeedSuccess {
  ok: true;
  sourceTitle: string;
  items: ParsedFeedItem[];
}

export interface ParseFeedFailure {
  ok: false;
  reason: 'malformed-xml' | 'not-a-feed';
}

export type ParseFeedResult = ParseFeedSuccess | ParseFeedFailure;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => name === 'item' || name === 'entry',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  removeNSPrefix: true,
});

/** Normalise various date formats to ISO 8601. */
function toIsoDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Safely extract text from a field that may be a string or an object with #text. */
function textOf(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && '#text' in val) {
    return String((val as Record<string, unknown>)['#text']) ?? '';
  }
  return String(val);
}

/** Extract the link href from Atom-style link elements. */
function atomLinkHref(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    // Prefer rel="alternate" or the first link
    const alt = val.find(
      (l) => l['@_rel'] === 'alternate' || !l['@_rel'],
    );
    return alt?.['@_href'] ?? val[0]?.['@_href'] ?? '';
  }
  if (typeof val === 'object' && val !== null) return (val as Record<string, unknown>)['@_href'] as string ?? '';
  return '';
}

// ── RSS 2.0 ──────────────────────────────────────────────────────

function parseRssChannel(channel: Record<string, unknown>): ParseFeedSuccess {
  const items = (channel.item ?? []) as Record<string, unknown>[];

  return {
    ok: true,
    sourceTitle: textOf(channel.title),
    items: items.map((item) => ({
      title: textOf(item.title),
      link: textOf(item.link),
      content: textOf(item.description) || textOf(item['content:encoded']),
      publishedAt: toIsoDate(textOf(item.pubDate)),
    })),
  };
}

// ── Atom ──────────────────────────────────────────────────────────

function parseAtomFeed(feed: Record<string, unknown>): ParseFeedSuccess {
  const entries = (feed.entry ?? []) as Record<string, unknown>[];

  return {
    ok: true,
    sourceTitle: textOf(feed.title),
    items: entries.map((entry) => ({
      title: textOf(entry.title),
      link: atomLinkHref(entry.link),
      content: textOf(entry.content) || textOf(entry.summary),
      publishedAt: toIsoDate(textOf(entry.published) || textOf(entry.updated)),
    })),
  };
}

// ── RDF (RSS 1.0) ────────────────────────────────────────────────

function parseRdf(root: Record<string, unknown>): ParseFeedSuccess {
  const items = (root.item ?? []) as Record<string, unknown>[];

  // Source title comes from the channel sub-element
  const channel = root.channel as Record<string, unknown> | undefined;

  return {
    ok: true,
    sourceTitle: textOf(channel?.title),
    items: items.map((item) => ({
      title: textOf(item.title),
      link: textOf(item.link),
      content: textOf(item.description),
      publishedAt: toIsoDate(textOf(item['dc:date'])),
    })),
  };
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Parse an RSS / Atom / RDF document into normalised feed items.
 *
 * Returns a discriminated union — never throws.
 */
export function parseFeed(xml: string): ParseFeedResult {
  // 1. Validate XML well-formedness
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    return {ok: false, reason: 'malformed-xml'};
  }

  // 2. Parse into JS object
  const parsed = parser.parse(xml) as Record<string, unknown>;

  // 3. Detect feed type and delegate
  if (parsed.rss) {
    const channel = (parsed.rss as Record<string, unknown>).channel as Record<string, unknown>;
    if (!channel) return {ok: false, reason: 'not-a-feed'};
    return parseRssChannel(channel);
  }

  if (parsed.feed) {
    return parseAtomFeed(parsed.feed as Record<string, unknown>);
  }

  if (parsed['RDF'] || parsed['rdf:RDF']) {
    const rdf = (parsed['RDF'] ?? parsed['rdf:RDF']) as Record<string, unknown>;
    return parseRdf(rdf);
  }

  return {ok: false, reason: 'not-a-feed'};
}
