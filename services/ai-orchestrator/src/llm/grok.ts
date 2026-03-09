import OpenAI from 'openai';
import { createLogger } from '@sloppy/logger';
import type { LLMClient, LLMResponse, LLMStreamCallbacks } from './types.js';

const log = createLogger('grok-client');

const GROK_BASE_URL = 'https://api.x.ai/v1';

export class GrokClient implements LLMClient {
  private static readonly MAX_OUTPUT_TOKENS = 131_072;

  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: GROK_BASE_URL,
      timeout: 300_000,
      maxRetries: 2,
    });
    this.model = model;
    log.info({ model, keyPrefix: apiKey.slice(0, 8) }, 'Grok client initialized');
  }

  private clampTokens(maxTokens: number): number {
    return Math.min(maxTokens, GrokClient.MAX_OUTPUT_TOKENS);
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

    const clamped = this.clampTokens(maxTokens);
    log.info({ model: this.model, maxTokens: clamped, promptLen: userPrompt.length }, 'generateText starting');
    const start = Date.now();

    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: clamped,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const finishReason = completion.choices[0]?.finish_reason;
    const content = completion.choices[0]?.message?.content ?? '';
    const usage = {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
    };

    log.info({ durationMs: Date.now() - start, usage, finishReason }, 'generateText completed');

    if (finishReason === 'length') {
      log.warn({ model: this.model, maxTokens: clamped, completionTokens: usage.completionTokens }, 'response truncated');
      throw new Error(`LLM response truncated at ${usage.completionTokens} tokens (max_tokens=${clamped}). Increase MAX_TOKENS or reduce prompt size.`);
    }

    callbacks?.onComplete?.({ content, usage });
    return { content, usage };
  }

  private async streamText(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    callbacks: LLMStreamCallbacks,
  ): Promise<LLMResponse> {
    const clamped = this.clampTokens(maxTokens);
    log.info({ model: this.model, maxTokens: clamped, promptLen: userPrompt.length }, 'streamText starting');
    const start = Date.now();

    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: clamped,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    let content = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let finishReason: string | null = null;

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const delta = choice?.delta?.content;
      if (delta) {
        content += delta;
        callbacks.onToken?.(delta);
      }
      if (choice?.finish_reason) {
        finishReason = choice.finish_reason;
      }
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens;
        completionTokens = chunk.usage.completion_tokens;
      }
    }

    if (finishReason === 'length') {
      log.warn({ model: this.model, maxTokens: clamped, completionTokens }, 'streaming response truncated');
      throw new Error(`LLM response truncated at ${completionTokens} tokens (max_tokens=${clamped}). Increase MAX_TOKENS or reduce prompt size.`);
    }

    const response: LLMResponse = {
      content,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };

    log.info({ durationMs: Date.now() - start, usage: response.usage }, 'streamText completed');
    callbacks.onComplete?.(response);
    return response;
  }

  async generateJSON<T = unknown>(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
  ): Promise<{ data: T; usage: LLMResponse['usage'] }> {
    const clamped = this.clampTokens(maxTokens);
    log.info({ model: this.model, maxTokens: clamped, promptLen: userPrompt.length }, 'generateJSON starting');
    const start = Date.now();

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: clamped,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt + '\n\nRespond ONLY with valid JSON.' },
          { role: 'user', content: userPrompt },
        ],
      });

      const finishReason = completion.choices[0]?.finish_reason;
      const raw = completion.choices[0]?.message?.content ?? '{}';
      const usage = {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      };

      if (finishReason === 'length') {
        log.warn({ model: this.model, maxTokens: clamped, completionTokens: usage.completionTokens }, 'generateJSON response truncated');
        throw new Error(`LLM response truncated at ${usage.completionTokens} tokens (max_tokens=${clamped}). Increase MAX_TOKENS or reduce prompt size.`);
      }

      log.info({ durationMs: Date.now() - start, usage }, 'generateJSON completed');
      return { data: JSON.parse(raw) as T, usage };
    } catch (err) {
      log.error(
        { durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) },
        'generateJSON failed',
      );
      throw err;
    }
  }
}
