import {z} from 'zod';
import {articleAnalysisSchema, ArticleAnalysisResult} from './article-analysis';

/**
 * The provider-agnostic seam for the LLM's semantic work (FR-3). Slice 4.2
 * exposes only `analyzeArticle`; `matchEntities` / `buildDigest` named in the
 * spec arrive in their own slices, so there are no throwing stubs for them here.
 * Production wiring picks an adapter from `LLM_PROVIDER`; tests inject
 * `StubLlmService`. Calls are made from the worker only, never from an HTTP
 * handler (Principle 3).
 */
export interface LlmService {
  analyzeArticle(input: AnalyzeArticleInput): Promise<ArticleAnalysisResult>;
}

/** The Article text handed to the LLM for a single Labelling. */
export interface AnalyzeArticleInput {
  title: string;
  content: string;
}

/** DI token for the active `LlmService` (mirrors `FEED_FETCHER`). */
export const LLM_SERVICE = Symbol('LlmService');

/**
 * Identifies the prompt + output contract a Labelling was produced under, so a
 * cached/stored Labelling can be invalidated when the contract changes. A code
 * constant, bumped deliberately — never read from the environment.
 */
export const PROMPT_VERSION = 'v1';

/**
 * The providers' structured-output JSON schema, derived from the one zod schema
 * rather than hand-written. OpenAI consumes it as `response_format.json_schema`
 * and Anthropic as a forced tool's `input_schema`; zod v4's native
 * `z.toJSONSchema` already emits `additionalProperties: false` with every field
 * required, which is what OpenAI strict mode demands. The `$schema` dialect key
 * is dropped so the body carries only the structure the providers read.
 */
export const analysisJsonSchema = (() => {
  const schema = z.toJSONSchema(articleAnalysisSchema) as Record<
    string,
    unknown
  >;
  delete schema.$schema;
  return schema;
})();
