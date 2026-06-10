/**
 * Deterministic, LLM-free pre-filter gate.
 *
 * Every Article passes through this before any LLM call. The function is a
 * pure decision based on content heuristics — no network, no DB, no queue.
 * Thresholds come from config (env-derived), not hard-coded.
 *
 * CONTEXT.md: Pre-Filter; `filtered` is a Processing State, never `junk`.
 */

export interface PreFilterable {
  title: string;
  content: string;
}

export interface PreFilterConfig {
  /** Minimum body length (chars) after stripping markup. Default: 200. */
  minLength?: number;
}

export interface PendingResult {
  state: 'pending';
}

export interface FilteredResult {
  state: 'filtered';
  reason: 'empty' | 'below-min-length' | 'no-extractable-text' | 'seo-boilerplate';
}

export type PreFilterResult = PendingResult | FilteredResult;

/** Strip HTML tags and collapse whitespace for text extraction. */
function extractText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect SEO boilerplate patterns.
 *
 * Checks for cookie/GDPR consent text and keyword-stuffed content
 * (same short phrase repeated many times).
 */
function isSeoBoilerplate(text: string): boolean {
  const lower = text.toLowerCase();

  // Cookie / GDPR consent boilerplate
  const cookiePatterns = [
    /we use cookies/i,
    /cookie policy/i,
    /cookie consent/i,
    /accept (our|all) cookies/i,
    /gdpr/i,
    /privacy preferences/i,
    /manage your (cookie|privacy|consent)/i,
  ];
  if (cookiePatterns.some(p => p.test(text))) {
    return true;
  }

  // Keyword stuffing: split into words, check if a short phrase repeats 8+ times
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length >= 16) {
    const phraseLen = 5;
    const counts = new Map<string, number>();
    for (let i = 0; i <= words.length - phraseLen; i++) {
      const phrase = words.slice(i, i + phraseLen).join(' ');
      const count = (counts.get(phrase) ?? 0) + 1;
      counts.set(phrase, count);
      if (count >= 8) return true;
    }
  }

  return false;
}

/**
 * Pre-filter an article item.
 *
 * Checks run in priority order:
 * 1. empty          — title and content both missing/empty
 * 2. no-extractable-text — content collapses to nothing after stripping HTML
 * 3. below-min-length — extractable text is shorter than the threshold
 * 4. seo-boilerplate — content matches spam/SEO patterns
 *
 * If none match, the item is `pending` (healthy content).
 */
export function preFilter(
  item: PreFilterable,
  config: PreFilterConfig = {},
): PreFilterResult {
  const minLength = config.minLength ?? Number(process.env.PREFILTER_MIN_LENGTH ?? 200);

  const content = item.content;
  const title = (item.title ?? '').trim();

  // 1. Empty — content is missing/null/empty AND no title
  if (!content && !title) {
    return {state: 'filtered', reason: 'empty'};
  }

  // 2. No extractable text — raw content exists but collapses to nothing
  //    after stripping HTML tags and whitespace.
  const text = content ? extractText(content) : '';
  if (content && !text) {
    return {state: 'filtered', reason: 'no-extractable-text'};
  }

  // 3. Below min length (count extractable text + title)
  const effectiveLength = text.length + title.length;
  if (effectiveLength > 0 && effectiveLength < minLength) {
    return {state: 'filtered', reason: 'below-min-length'};
  }

  // 4. SEO boilerplate
  const fullText = title.trim() + ' ' + text;
  if (isSeoBoilerplate(fullText)) {
    return {state: 'filtered', reason: 'seo-boilerplate'};
  }

  return {state: 'pending'};
}
