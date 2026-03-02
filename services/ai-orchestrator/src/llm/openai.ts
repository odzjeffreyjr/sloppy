import OpenAI from 'openai';
import { createLogger } from '@sloppy/logger';
import type { LLMClient, LLMResponse, LLMStreamCallbacks } from './types.js';

const log = createLogger('openai-client');

export class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 2 });
    this.model = model;
    log.info({ model, keyPrefix: apiKey.slice(0, 12) }, 'OpenAI client initialized');
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    callbacks?: LLMStreamCallbacks,
  ): Promise<LLMResponse> {
    if (callbacks?.onToken) {
      return this.streamText(systemPrompt, userPrompt, maxTokens, callbacks);
    }

    log.info({ model: this.model, maxTokens, promptLen: userPrompt.length }, 'generateText starting');
    const start = Date.now();

    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? '';
    const usage = {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
    };

    log.info({ durationMs: Date.now() - start, usage }, 'generateText completed');
    callbacks?.onComplete?.({ content, usage });
    return { content, usage };
  }

  private async streamText(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    callbacks: LLMStreamCallbacks,
  ): Promise<LLMResponse> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    let content = '';
    let promptTokens = 0;
    let completionTokens = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        content += delta;
        callbacks.onToken?.(delta);
      }
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens;
        completionTokens = chunk.usage.completion_tokens;
      }
    }

    const response: LLMResponse = {
      content,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };

    callbacks.onComplete?.(response);
    return response;
  }

  async generateJSON<T = unknown>(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
  ): Promise<{ data: T; usage: LLMResponse['usage'] }> {
    log.info({ model: this.model, maxTokens, promptLen: userPrompt.length }, 'generateJSON starting');
    const start = Date.now();

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        max_completion_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt + '\n\nRespond ONLY with valid JSON.' },
          { role: 'user', content: userPrompt },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      const usage = {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      };

      log.info({ durationMs: Date.now() - start, usage }, 'generateJSON completed');
      return { data: JSON.parse(raw) as T, usage };
    } catch (err) {
      log.error({ durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) }, 'generateJSON failed');
      throw err;
    }
  }
}
