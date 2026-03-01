export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMStreamCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (response: LLMResponse) => void;
}

export interface LLMClient {
  generateText(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    callbacks?: LLMStreamCallbacks,
  ): Promise<LLMResponse>;

  generateJSON<T = unknown>(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
  ): Promise<{ data: T; usage: LLMResponse['usage'] }>;
}
