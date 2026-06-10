/**
 * Shared URL-normalisation authority.
 *
 * Used by both Feed-URL and Article-URL paths so that duplicate detection
 * sees through trailing-slash and host-case differences.
 */
export function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hostname = parsed.hostname.toLowerCase();
    let out = parsed.toString();
    if (out.endsWith('/')) out = out.slice(0, -1);
    return out;
  } catch {
    return url.trim().toLowerCase();
  }
}
