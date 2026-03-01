import { validateGameSource } from '@sloppy/runtime-sdk';
import type { LLMClient } from '../llm/index.js';
import {
  CODE_SYSTEM_PROMPT,
  buildCodeUserPrompt,
  buildCodeRetryPrompt,
} from '../prompts/index.js';
import { config } from '../config.js';
import type { GameConcept, PipelineContext, ProgressCallback } from './types.js';

function stripMarkdownFences(code: string): string {
  return code
    .replace(/^```(?:javascript|js)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

function validateCode(source: string): { valid: boolean; errors: string[] } {
  const result = validateGameSource(source);
  const errors = [...result.errors];

  if (!source.includes('window.SloppyGame')) {
    errors.push('Code must assign to window.SloppyGame');
  }

  return { valid: errors.length === 0, errors };
}

export async function runCodePhase(
  ctx: PipelineContext,
  llm: LLMClient,
  onProgress: ProgressCallback,
): Promise<string> {
  const concept = ctx.concept!;

  onProgress('code', 10, 'Generating game code…');

  let tokenCount = 0;
  const streamProgress: Parameters<typeof llm.generateText>[3] = {
    onToken: () => {
      tokenCount++;
      const progress = Math.min(80, 10 + Math.floor((tokenCount / config.generation.maxTokens.code) * 70));
      if (tokenCount % 50 === 0) {
        onProgress('code', progress, 'Writing game code…');
      }
    },
  };

  let response = await llm.generateText(
    CODE_SYSTEM_PROMPT,
    buildCodeUserPrompt(concept),
    config.generation.maxTokens.code,
    streamProgress,
  );

  ctx.tokenUsage.promptTokens += response.usage.promptTokens;
  ctx.tokenUsage.completionTokens += response.usage.completionTokens;
  ctx.tokenUsage.totalTokens += response.usage.totalTokens;

  let code = stripMarkdownFences(response.content);
  let validation = validateCode(code);

  if (!validation.valid) {
    onProgress('code', 85, 'Validation failed, retrying…');

    response = await llm.generateText(
      CODE_SYSTEM_PROMPT,
      buildCodeRetryPrompt(concept, code, validation.errors),
      config.generation.maxTokens.code,
    );

    ctx.tokenUsage.promptTokens += response.usage.promptTokens;
    ctx.tokenUsage.completionTokens += response.usage.completionTokens;
    ctx.tokenUsage.totalTokens += response.usage.totalTokens;

    code = stripMarkdownFences(response.content);
    validation = validateCode(code);

    if (!validation.valid) {
      throw new Error(
        `Code validation failed after retry: ${validation.errors.join('; ')}`,
      );
    }
  }

  onProgress('code', 100, 'Game code generated and validated');
  return code;
}
