import type { PipelineContext, ProgressCallback } from './types.js';

export async function runMusicPhase(
  _ctx: PipelineContext,
  onProgress: ProgressCallback,
): Promise<void> {
  onProgress('music', 100, 'Skipped — audio generation not yet available');
}
