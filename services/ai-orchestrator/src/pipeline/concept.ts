import type { LLMClient } from '../llm/index.js';
import { CONCEPT_SYSTEM_PROMPT, buildConceptUserPrompt } from '../prompts/index.js';
import { config } from '../config.js';
import type { GameConcept, PipelineContext, ProgressCallback } from './types.js';

export async function runConceptPhase(
  ctx: PipelineContext,
  llm: LLMClient,
  onProgress: ProgressCallback,
): Promise<GameConcept> {
  onProgress('concept', 10, 'Designing game concept…');

  const { data, usage } = await llm.generateJSON<GameConcept>(
    CONCEPT_SYSTEM_PROMPT,
    buildConceptUserPrompt(ctx.prompt),
    config.generation.maxTokens.concept,
  );

  ctx.tokenUsage.promptTokens += usage.promptTokens;
  ctx.tokenUsage.completionTokens += usage.completionTokens;
  ctx.tokenUsage.totalTokens += usage.totalTokens;

  if (!data.title || !data.description || !data.mechanics?.length) {
    throw new Error('LLM returned incomplete game concept');
  }

  onProgress('concept', 100, `Concept ready: "${data.title}"`);
  return data;
}
