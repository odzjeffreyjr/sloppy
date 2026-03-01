import Anthropic from '@anthropic-ai/sdk';
import type { LLMClient, LLMResponse, LLMStreamCallbacks } from './types.js';

export class AnthropicClient implements LLMClient {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
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

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
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

    callbacks?.onComplete?.({ content, usage });
    return { content, usage };
  }

  private async streamText(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    callbacks: LLMStreamCallbacks,
  ): Promise<LLMResponse> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: maxTokens,
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

    callbacks.onComplete?.(response);
    return response;
  }

  async generateJSON<T = unknown>(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
  ): Promise<{ data: T; usage: LLMResponse['usage'] }> {
    const response = await this.generateText(
      systemPrompt + '\n\nRespond ONLY with valid JSON. No markdown, no explanation.',
      userPrompt,
      maxTokens,
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('LLM did not return valid JSON');
    }

    return { data: JSON.parse(jsonMatch[0]) as T, usage: response.usage };
  }
}
