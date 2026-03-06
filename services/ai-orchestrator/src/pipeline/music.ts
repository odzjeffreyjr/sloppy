import type { PipelineContext, ProgressCallback } from './types.js';

export async function runMusicPhase(
  _ctx: PipelineContext,
  onProgress: ProgressCallback,
): Promise<void> {
  onProgress('audio', 100, 'Skipped — audio generation not yet available');
}
