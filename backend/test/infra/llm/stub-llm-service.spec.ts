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

  it('returns the canned result registered for the input content', async () => {
    const stub = new StubLlmService();
    stub.set('article body', result);

    await expect(
      stub.analyzeArticle({title: 'T', content: 'article body'}),
    ).resolves.toEqual(result);
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
