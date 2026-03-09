import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '@sloppy/logger';
import type { LLMClient, LLMResponse, LLMStreamCallbacks } from './types.js';

const log = createLogger('anthropic-client');

export class AnthropicClient implements LLMClient {
  private static readonly MAX_OUTPUT_TOKENS = 64_000;

  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey, timeout: 300_000, maxRetries: 2 });
    this.model = model;
    log.info({ model, keyPrefix: apiKey.slice(0, 8) }, 'Anthropic client initialized');
  }

  private clampTokens(maxTokens: number): number {
    return Math.min(maxTokens, AnthropicClient.MAX_OUTPUT_TOKENS);
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

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: clamped,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content =
      message.content[0]?.type === 'text' ? message.content[0].text : '';
    const usage = {
      promptTokens: message.usage.input_tokens,
      completionTokens: message.usage.output_tokens,
      totalTokens: message.usage.input_tokens + message.usage.output_tokens,
    };

    log.info({ durationMs: Date.now() - start, usage, stopReason: message.stop_reason }, 'generateText completed');

    if (message.stop_reason === 'max_tokens') {
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

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: clamped,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let content = '';

    stream.on('text', (text) => {
      content += text;
      callbacks.onToken?.(text);
    });

    const finalMessage = await stream.finalMessage();

    const response: LLMResponse = {
      content,
      usage: {
        promptTokens: finalMessage.usage.input_tokens,
        completionTokens: finalMessage.usage.output_tokens,
        totalTokens:
          finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
      },
    };

    log.info({ durationMs: Date.now() - start, usage: response.usage, stopReason: finalMessage.stop_reason }, 'streamText completed');

    if (finalMessage.stop_reason === 'max_tokens') {
      log.warn({ model: this.model, maxTokens: clamped, completionTokens: response.usage.completionTokens }, 'streaming response truncated');
      throw new Error(`LLM response truncated at ${response.usage.completionTokens} tokens (max_tokens=${clamped}). Increase MAX_TOKENS or reduce prompt size.`);
    }

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
      const response = await this.generateText(
        systemPrompt + '\n\nRespond ONLY with valid JSON. No markdown fences, no explanation.',
        userPrompt,
        maxTokens,
      );

      const text = response.content.trim();

      // Try to extract JSON from markdown code fences first
      const fencedJson = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/i);
      const jsonStr = fencedJson ? fencedJson[1].trim() : text;

      // Find the outermost JSON object
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');

      if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
        log.error(
          { durationMs: Date.now() - start, contentPreview: text.slice(0, 200) },
          'generateJSON: no JSON object found in response',
        );
        throw new Error('LLM did not return valid JSON');
      }

      const extracted = jsonStr.slice(jsonStart, jsonEnd + 1);
      const data = JSON.parse(extracted) as T;

      log.info({ durationMs: Date.now() - start, usage: response.usage }, 'generateJSON completed');
      return { data, usage: response.usage };
    } catch (err) {
      log.error(
        { durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) },
        'generateJSON failed',
      );
      throw err;
    }
  }
}
