import {LlmValidationError} from '../../../src/infra/llm/article-analysis';
import {ArticleAnalysisResult} from '../../../src/infra/llm/article-analysis';
import {StubLlmService} from '../../support/stub-llm-service';

/**
 * The `StubLlmService` is the LLM analogue of `StubFeedFetcher`: a deterministic
 * double downstream slices (the label worker, telemetry) drive without touching
 * a provider. It returns a canned result per content, can simulate a provider
 * outage or a validation failure, and records its call count.
 */
describe('StubLlmService', () => {
  const result: ArticleAnalysisResult = {
    summary: 'Canned summary.',
    importance: 'normal',
    entities: [{name: 'OpenAI', type: 'company'}],
  };

  it('returns the canned analysis registered for the input content', async () => {
    const stub = new StubLlmService();
    stub.set('article body', result);

    const {analysis} = await stub.analyzeArticle({
      title: 'T',
      content: 'article body',
    });
    expect(analysis).toEqual(result);
  });

  it('surfaces the registered token usage alongside the analysis', async () => {
    const stub = new StubLlmService();
    stub.set('body', result, {
      promptTokens: 11,
      completionTokens: 7,
      totalTokens: 18,
    });

    const {usage} = await stub.analyzeArticle({title: 'T', content: 'body'});
    expect(usage).toEqual({
      promptTokens: 11,
      completionTokens: 7,
      totalTokens: 18,
    });
  });

  it('defaults usage to zero when none is registered', async () => {
    const stub = new StubLlmService();
    stub.set('body', result);

    const {usage} = await stub.analyzeArticle({title: 'T', content: 'body'});
    expect(usage).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });

  it('counts every analyzeArticle call', async () => {
    const stub = new StubLlmService();
    stub.set('body', result);

    await stub.analyzeArticle({title: 'T', content: 'body'});
    await stub.analyzeArticle({title: 'T', content: 'body'});

    expect(stub.callCount).toBe(2);
  });

  it('throws to simulate the provider being unavailable', async () => {
    const stub = new StubLlmService();
    stub.failWith(new Error('provider unavailable'));

    await expect(
      stub.analyzeArticle({title: 'T', content: 'anything'}),
    ).rejects.toThrow('provider unavailable');
  });

  it('can surface an LlmValidationError for a validation-failing shape', async () => {
    const stub = new StubLlmService();
    stub.failWith(new LlmValidationError('bad shape'));

    await expect(
      stub.analyzeArticle({title: 'T', content: 'anything'}),
    ).rejects.toBeInstanceOf(LlmValidationError);
  });
});
