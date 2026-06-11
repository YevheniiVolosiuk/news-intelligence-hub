import {ArticleAnalysisResult} from '../../src/infra/llm/article-analysis';
import {
  AnalyzeArticleInput,
  AnalyzeArticleResult,
  LlmService,
  TokenUsage,
} from '../../src/infra/llm/llm-service';

const ZERO_USAGE: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

/**
 * Deterministic `LlmService` double for downstream slices, analogue of
 * `StubFeedFetcher`. Holds a canned result + token usage per content, can be
 * told to throw (a plain error for a provider outage, or an `LlmValidationError`
 * for a validation-failing shape), and records how many times it was called.
 */
export class StubLlmService implements LlmService {
  private readonly results = new Map<string, AnalyzeArticleResult>();
  private error?: Error;
  callCount = 0;

  /** Canned provider/model identity, mirroring a real adapter's resolution. */
  readonly provider = 'stub';
  readonly model = 'stub-model';

  set(
    content: string,
    analysis: ArticleAnalysisResult,
    usage: TokenUsage = ZERO_USAGE,
  ): void {
    this.results.set(content, {analysis, usage});
  }

  failWith(error: Error | undefined): void {
    this.error = error;
  }

  clear(): void {
    this.results.clear();
    this.error = undefined;
    this.callCount = 0;
  }

  async analyzeArticle(
    input: AnalyzeArticleInput,
  ): Promise<AnalyzeArticleResult> {
    this.callCount += 1;
    if (this.error) throw this.error;
    const result = this.results.get(input.content);
    if (!result) {
      throw new Error('StubLlmService: no canned result for content');
    }
    return result;
  }
}
