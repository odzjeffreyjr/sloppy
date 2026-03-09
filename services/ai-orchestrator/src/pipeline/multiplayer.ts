import { validateGameSource } from '@sloppy/runtime-sdk';
import type { LLMClient } from '../llm/index.js';
import {
  MULTIPLAYER_SYSTEM_PROMPT,
  buildMultiplayerUserPrompt,
} from '../prompts/index.js';
import { config } from '../config.js';
import type { PipelineContext, ProgressCallback } from './types.js';

function stripMarkdownFences(code: string): string {
  const fenceMatch = code.match(/```(?:html|javascript|js)?\s*\n([\s\S]*?)\n```/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return code
    .replace(/^```(?:javascript|js)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

export async function runMultiplayerPhase(
  ctx: PipelineContext,
  llm: LLMClient,
  onProgress: ProgressCallback,
): Promise<string> {
  const gameCode = ctx.gameCode!;

  if (!ctx.concept?.supportsMultiplayer) {
    onProgress('multiplayer', 100, 'Skipped — single-player game');
    return gameCode;
  }

  onProgress('multiplayer', 10, 'Adding multiplayer support…');

  const response = await llm.generateText(
    MULTIPLAYER_SYSTEM_PROMPT,
    buildMultiplayerUserPrompt(gameCode),
    config.generation.maxTokens.multiplayer,
  );

  ctx.tokenUsage.promptTokens += response.usage.promptTokens;
  ctx.tokenUsage.completionTokens += response.usage.completionTokens;
  ctx.tokenUsage.totalTokens += response.usage.totalTokens;

  const code = stripMarkdownFences(response.content);

  const validation = validateGameSource(code);
  if (!validation.valid) {
    console.warn('Multiplayer code failed validation, using single-player version:', validation.errors);
    onProgress('multiplayer', 100, 'Multiplayer injection failed validation — using single-player');
    return gameCode;
  }

  onProgress('multiplayer', 100, 'Multiplayer hooks added');
  return code;
}
