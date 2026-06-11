import {createHash} from 'crypto';

/**
 * The identity of a cached LLM analysis (FR-10): `sha256(content_hash + model +
 * prompt_version)`. Folding the model and prompt_version into the key means a
 * switched `LLM_MODEL` or a bumped `PROMPT_VERSION` misses the cache by
 * construction rather than reusing a result produced under a different contract.
 * Provider is implied by the model, so it is not keyed separately. The parts are
 * concatenated literally — `content_hash` is a fixed-length hex digest, so the
 * short, fixed `model`/`prompt_version` suffixes cannot collide in practice.
 */
export function llmCacheKey(
  contentHash: string,
  model: string,
  promptVersion: string,
): string {
  return createHash('sha256')
    .update(`${contentHash}${model}${promptVersion}`)
    .digest('hex');
}
