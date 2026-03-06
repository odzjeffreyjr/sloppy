import type { LLMClient } from '../llm/index.js';
import { ASSETS_SYSTEM_PROMPT, buildAssetsUserPrompt } from '../prompts/index.js';
import { config } from '../config.js';
import type { GeneratedAsset, PipelineContext, ProgressCallback } from './types.js';

export async function runAssetsPhase(
  ctx: PipelineContext,
  llm: LLMClient,
  onProgress: ProgressCallback,
): Promise<GeneratedAsset[]> {
  const concept = ctx.concept!;

  if (!concept.assets.length) {
    onProgress('coding', 100, 'No assets needed');
    return [];
  }

  onProgress('coding', 10, 'Generating game assets…');

  const { data, usage } = await llm.generateJSON<{ assets: GeneratedAsset[] }>(
    ASSETS_SYSTEM_PROMPT,
    buildAssetsUserPrompt(concept),
    config.generation.maxTokens.assets,
  );

  ctx.tokenUsage.promptTokens += usage.promptTokens;
  ctx.tokenUsage.completionTokens += usage.completionTokens;
  ctx.tokenUsage.totalTokens += usage.totalTokens;

  const assets = data.assets ?? [];
  onProgress('coding', 100, `Generated ${assets.length} assets`);
  return assets;
}
