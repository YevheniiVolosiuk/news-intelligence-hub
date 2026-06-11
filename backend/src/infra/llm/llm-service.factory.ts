import {AnthropicLlmService} from './anthropic-llm-service';
import {LlmService} from './llm-service';
import {OpenAiLlmService} from './openai-llm-service';

/**
 * Selects the active adapter from `LLM_PROVIDER` at startup. An unknown value
 * fails fast rather than silently defaulting, so a misconfigured provider is
 * caught at boot instead of on the first Article.
 */
export function createLlmService(
  provider: string | undefined = process.env.LLM_PROVIDER,
): LlmService {
  switch (provider) {
    case 'openai':
      return new OpenAiLlmService();
    case 'anthropic':
      return new AnthropicLlmService();
    default:
      throw new Error(
        `Unknown LLM_PROVIDER "${provider ?? ''}": expected "openai" or "anthropic"`,
      );
  }
}
