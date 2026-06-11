import {Logger} from '@nestjs/common';
import {ArticleAnalysisResult, parseAnalysisResult} from './article-analysis';
import {fetchLlmHttpPost, LlmHttpPost, postWithTimeout} from './llm-http';
import {
  analysisJsonSchema,
  AnalyzeArticleInput,
  LlmService,
  PROMPT_VERSION,
} from './llm-service';

const ANTHROPIC_VERSION = '2023-06-01';
const TOOL_NAME = 'record_analysis';
const ANALYSIS_INSTRUCTION =
  'Analyze the article and call the record_analysis tool with a summary, an ' +
  'importance verdict, and the named entities. Use only the importance and ' +
  'entity-type vocabularies the tool schema allows.';

/**
 * Anthropic adapter. Forces a single `tool_use` whose `input_schema` is the
 * shared schema, then validates the tool input against that same schema — a
 * malformed input raises `LlmValidationError` and is never returned. Request
 * shaping is verified against the Anthropic docs and end-to-end by later flow
 * slices, not unit-tested here.
 */
export class AnthropicLlmService implements LlmService {
  private readonly logger = new Logger(AnthropicLlmService.name);
  private readonly post: LlmHttpPost;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;

  constructor(post: LlmHttpPost = fetchLlmHttpPost) {
    this.post = post;
    this.apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    this.model = process.env.LLM_MODEL ?? 'claude-haiku-4-5-20251001';
    this.maxTokens = Number(process.env.LLM_MAX_TOKENS ?? 1024);
    this.timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 30000);
  }

  async analyzeArticle(
    input: AnalyzeArticleInput,
  ): Promise<ArticleAnalysisResult> {
    const body = JSON.stringify({
      model: this.model,
      max_tokens: this.maxTokens,
      tools: [
        {
          name: TOOL_NAME,
          description: 'Record the structured analysis of the article.',
          input_schema: analysisJsonSchema,
        },
      ],
      tool_choice: {type: 'tool', name: TOOL_NAME},
      messages: [
        {
          role: 'user',
          content: `${ANALYSIS_INSTRUCTION}\n\n${input.title}\n\n${input.content}`,
        },
      ],
    });

    const res = await postWithTimeout(
      this.post,
      'https://api.anthropic.com/v1/messages',
      {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body,
      this.timeoutMs,
    );

    if (!res.ok) {
      this.logger.log(
        `analyzeArticle provider=anthropic outcome=unavailable status=${res.status}`,
      );
      throw new Error(`Anthropic request failed with status ${res.status}`);
    }

    const payload = (await res.json()) as {
      content?: {type: string; name?: string; input?: unknown}[];
    };
    const toolUse = payload.content?.find(
      block => block.type === 'tool_use' && block.name === TOOL_NAME,
    );
    const result = parseAnalysisResult(toolUse?.input);
    this.logger.log(
      `analyzeArticle provider=anthropic outcome=ok prompt_version=${PROMPT_VERSION}`,
    );
    return result;
  }
}
