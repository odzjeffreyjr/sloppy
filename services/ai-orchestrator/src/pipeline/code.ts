import { validateGameSource } from '@sloppy/runtime-sdk';
import type { LLMClient } from '../llm/index.js';
import {
  buildCodeSystemPrompt,
  buildCodeUserPrompt,
  buildCodeRetryPrompt,
} from '../prompts/code.js';
import { config } from '../config.js';
import type { PipelineContext, ProgressCallback } from './types.js';

function stripMarkdownFences(code: string): string {
  return code
    .replace(/^```(?:html|javascript|js)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

/**
 * Extract the inline JavaScript from the generated HTML so we can run
 * source-level validation (forbidden patterns, required method names).
 */
export function extractInlineScript(html: string): string {
  const scripts: string[] = [];
  const re = /<script(?:\s[^>]*)?>([^]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    if (tag.includes(' src=')) continue;
    scripts.push(match[1]);
  }
  return scripts.join('\n');
}

function validateGeneratedHtml(html: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!html.includes('<!DOCTYPE html>') && !html.includes('<!doctype html>')) {
    errors.push('Output must be a complete HTML document starting with <!DOCTYPE html>');
  }

  if (!html.includes('window.SloppyGame')) {
    errors.push('Code must assign to window.SloppyGame');
  }

  const inlineJs = extractInlineScript(html);
  if (!inlineJs.trim()) {
    errors.push('HTML must contain inline <script> tags with game code');
  }

  const sourceResult = validateGameSource(inlineJs);
  errors.push(...sourceResult.errors);

  return { valid: errors.length === 0, errors };
}

export async function runCodePhase(
  ctx: PipelineContext,
  llm: LLMClient,
  onProgress: ProgressCallback,
): Promise<string> {
  const gdd = ctx.gdd!;
  const spec = ctx.spec!;

  onProgress('coding', 10, 'Generating game code…');

  const systemPrompt = buildCodeSystemPrompt(gdd, spec);
  const userPrompt = buildCodeUserPrompt(gdd, spec);

  let tokenCount = 0;
  const streamProgress: Parameters<typeof llm.generateText>[3] = {
    onToken: () => {
      tokenCount++;
      const progress = Math.min(80, 10 + Math.floor((tokenCount / config.generation.maxTokens.code) * 70));
      if (tokenCount % 50 === 0) {
        onProgress('coding', progress, 'Writing game code…');
      }
    },
  };

  let response = await llm.generateText(
    systemPrompt,
    userPrompt,
    config.generation.maxTokens.code,
    streamProgress,
  );

  ctx.tokenUsage.promptTokens += response.usage.promptTokens;
  ctx.tokenUsage.completionTokens += response.usage.completionTokens;
  ctx.tokenUsage.totalTokens += response.usage.totalTokens;

  let html = stripMarkdownFences(response.content);
  let validation = validateGeneratedHtml(html);

  if (!validation.valid) {
    onProgress('coding', 85, 'Validation failed, retrying…');

    response = await llm.generateText(
      systemPrompt,
      buildCodeRetryPrompt(gdd, spec, html, validation.errors),
      config.generation.maxTokens.code,
    );

    ctx.tokenUsage.promptTokens += response.usage.promptTokens;
    ctx.tokenUsage.completionTokens += response.usage.completionTokens;
    ctx.tokenUsage.totalTokens += response.usage.totalTokens;

    html = stripMarkdownFences(response.content);
    validation = validateGeneratedHtml(html);

    if (!validation.valid) {
      throw new Error(
        `Code validation failed after retry: ${validation.errors.join('; ')}`,
      );
    }
  }

  onProgress('coding', 100, 'Game code generated and validated');
  return html;
}
