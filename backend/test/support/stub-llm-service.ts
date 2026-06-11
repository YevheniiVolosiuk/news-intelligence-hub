import {ArticleAnalysisResult} from '../../src/infra/llm/article-analysis';
import {AnalyzeArticleInput, LlmService} from '../../src/infra/llm/llm-service';

/**
 * Deterministic `LlmService` double for downstream slices, analogue of
 * `StubFeedFetcher`. Holds a canned result per content, can be told to throw
 * (a plain error for a provider outage, or an `LlmValidationError` for a
 * validation-failing shape), and records how many times it was called.
 */
export class StubLlmService implements LlmService {
  private readonly results = new Map<string, ArticleAnalysisResult>();
  private error?: Error;
  callCount = 0;

  set(content: string, result: ArticleAnalysisResult): void {
    this.results.set(content, result);
  }

  failWith(error: Error): void {
    this.error = error;
  }

  clear(): void {
    this.results.clear();
    this.error = undefined;
    this.callCount = 0;
  }

  async analyzeArticle(input: AnalyzeArticleInput): Promise<ArticleAnalysisResult> {
    this.callCount += 1;
    if (this.error) throw this.error;
    const result = this.results.get(input.content);
    if (!result) {
      throw new Error(`StubLlmService: no canned result for content`);
    }
    return result;
  }
}
