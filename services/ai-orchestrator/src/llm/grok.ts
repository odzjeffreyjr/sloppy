import OpenAI from 'openai';
import type { LLMClient, LLMResponse, LLMStreamCallbacks } from './types.js';

const GROK_BASE_URL = 'https://api.x.ai/v1';

export class GrokClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey, baseURL: GROK_BASE_URL });
    this.model = model;
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

    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
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
      max_tokens: maxTokens,
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
    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
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

    return { data: JSON.parse(raw) as T, usage };
  }
}
