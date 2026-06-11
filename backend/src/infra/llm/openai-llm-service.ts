import {Logger} from '@nestjs/common';
import {parseAnalysisResult} from './article-analysis';
import {fetchLlmHttpPost, LlmHttpPost, postWithTimeout} from './llm-http';
import {
  analysisJsonSchema,
  AnalyzeArticleInput,
  AnalyzeArticleResult,
  LlmService,
  PROMPT_VERSION,
  TokenUsage,
} from './llm-service';

const ANALYSIS_INSTRUCTION =
  'Analyze the article. Return a summary, an importance verdict, and the ' +
  'named entities. Use only the importance and entity-type vocabularies the ' +
  'schema allows.';

/**
 * OpenAI adapter. Forces a strict structured output via
 * `response_format: json_schema` (the schema derived from the shared zod
 * schema), then validates the completion against that same schema — a malformed
 * completion raises `LlmValidationError` and is never returned. Request shaping
 * is verified against the OpenAI docs and end-to-end by later flow slices, not
 * unit-tested here.
 */
export class OpenAiLlmService implements LlmService {
  private readonly logger = new Logger(OpenAiLlmService.name);
  private readonly post: LlmHttpPost;
  private readonly apiKey: string;
  readonly provider = 'openai';
  readonly model: string;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;

  constructor(post: LlmHttpPost = fetchLlmHttpPost) {
    this.post = post;
    this.apiKey = process.env.OPENAI_API_KEY ?? '';
    this.model = process.env.LLM_MODEL ?? 'gpt-4o-mini';
    this.maxTokens = Number(process.env.LLM_MAX_TOKENS ?? 1024);
    this.timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 30000);
  }

  async analyzeArticle(
    input: AnalyzeArticleInput,
  ): Promise<AnalyzeArticleResult> {
    const body = JSON.stringify({
      model: this.model,
      max_completion_tokens: this.maxTokens,
      messages: [
        {role: 'system', content: ANALYSIS_INSTRUCTION},
        {role: 'user', content: `${input.title}\n\n${input.content}`},
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'article_analysis',
          strict: true,
          schema: analysisJsonSchema,
        },
      },
    });

    const res = await postWithTimeout(
      this.post,
      'https://api.openai.com/v1/chat/completions',
      {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body,
      this.timeoutMs,
    );

    if (!res.ok) {
      this.logger.log(
        `analyzeArticle provider=openai outcome=unavailable status=${res.status}`,
      );
      throw new Error(`OpenAI request failed with status ${res.status}`);
    }

    const payload = (await res.json()) as {
      choices?: {message?: {content?: string}}[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    const content = payload.choices?.[0]?.message?.content ?? '';
    const analysis = parseAnalysisResult(safeJsonParse(content));
    this.logger.log(
      `analyzeArticle provider=openai outcome=ok prompt_version=${PROMPT_VERSION}`,
    );
    return {analysis, usage: openAiUsage(payload.usage)};
  }
}

/** Maps OpenAI's `usage` block to the seam's `TokenUsage`, defaulting to zero. */
function openAiUsage(usage?: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}): TokenUsage {
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage?.total_tokens ?? promptTokens + completionTokens,
  };
}

/** Parses a JSON string, yielding `undefined` so a bad body fails validation. */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
