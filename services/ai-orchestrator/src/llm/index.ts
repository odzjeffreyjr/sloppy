import { config } from '../config.js';
import type { LLMClient } from './types.js';
import { OpenAIClient } from './openai.js';
import { AnthropicClient } from './anthropic.js';
import { GrokClient } from './grok.js';

export type { LLMClient, LLMResponse, LLMStreamCallbacks } from './types.js';

let client: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!client) {
    const { provider, openai, anthropic, grok } = config.llm;

    switch (provider) {
      case 'anthropic':
        if (!anthropic.apiKey) throw new Error('ANTHROPIC_API_KEY is required');
        client = new AnthropicClient(anthropic.apiKey, anthropic.model);
        break;
      case 'grok':
        if (!grok.apiKey) throw new Error('GROK_API_KEY is required');
        client = new GrokClient(grok.apiKey, grok.model);
        break;
      default:
        if (!openai.apiKey) throw new Error('OPENAI_API_KEY is required');
        client = new OpenAIClient(openai.apiKey, openai.model);
        break;
    }
  }

  return client;
}
