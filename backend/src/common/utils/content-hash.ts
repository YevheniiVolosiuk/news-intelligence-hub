import {createHash} from 'crypto';

/**
 * Deterministic SHA-256 over an item's normalised content.
 *
 * Used for Duplicate / Similar detection — two items with the same title + body
 * produce the same hash, regardless of where they were fetched from.
 * The hash is computed over a JSON-encoded pair `[title, body]` so that
 * `{title:"A",body:"B"}` never collides with `{title:"B",body:"A"}`.
 */
export function computeContentHash(title: string, body: string): string {
  return createHash('sha256').update(JSON.stringify([title, body])).digest('hex');
}
