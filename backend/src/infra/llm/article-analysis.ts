import {z} from 'zod';

/**
 * The single source of truth for an Article's Labelling payload (CONTEXT.md:
 * summary + Importance verdict + extracted Entities). The TypeScript type is
 * `z.infer`'d from this schema and the providers' structured-output JSON schema
 * is derived from it (see `analysisJsonSchema`) — never a second hand copy.
 */
export const articleAnalysisSchema = z.object({
  summary: z.string(),
  importance: z.enum(['important', 'normal', 'junk']),
  entities: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['person', 'company', 'product', 'technology', 'location']),
    }),
  ),
});

export type ArticleAnalysisResult = z.infer<typeof articleAnalysisSchema>;

/**
 * Validates a raw provider response against the shared schema. A response that
 * does not match raises `LlmValidationError` and is never returned, so a
 * malformed or partial completion can never masquerade as a Labelling.
 */
export function parseAnalysisResult(raw: unknown): ArticleAnalysisResult {
  const parsed = articleAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new LlmValidationError(parsed.error.message);
  }
  return parsed.data;
}

/** Raised when a provider response fails to validate against the shared schema. */
export class LlmValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmValidationError';
  }
}
