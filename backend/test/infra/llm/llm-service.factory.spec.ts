import {AnthropicLlmService} from '../../../src/infra/llm/anthropic-llm-service';
import {createLlmService} from '../../../src/infra/llm/llm-service.factory';
import {OpenAiLlmService} from '../../../src/infra/llm/openai-llm-service';

/**
 * The factory is the one place that knows which provider is active: it maps
 * `LLM_PROVIDER` to an adapter and fails fast on an unknown value, so a typo is
 * caught at boot rather than on the first Article.
 */
describe('createLlmService', () => {
  it('selects the OpenAI adapter for LLM_PROVIDER=openai', () => {
    expect(createLlmService('openai')).toBeInstanceOf(OpenAiLlmService);
  });

  it('selects the Anthropic adapter for LLM_PROVIDER=anthropic', () => {
    expect(createLlmService('anthropic')).toBeInstanceOf(AnthropicLlmService);
  });

  it('throws on an unknown LLM_PROVIDER', () => {
    expect(() => createLlmService('gemini')).toThrow(/Unknown LLM_PROVIDER/);
  });

  it('throws when LLM_PROVIDER is unset', () => {
    expect(() => createLlmService(undefined)).toThrow(/Unknown LLM_PROVIDER/);
  });
});
