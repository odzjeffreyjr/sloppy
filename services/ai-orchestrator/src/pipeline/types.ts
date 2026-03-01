import type { GenerationPhase } from '@sloppy/shared';

export interface GameConcept {
  title: string;
  description: string;
  mechanics: string[];
  visualStyle: string;
  supportsMultiplayer: boolean;
  assets: Array<{
    name: string;
    description: string;
    type: 'emoji' | 'shape' | 'svg';
  }>;
  controls: string;
  winCondition: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface GeneratedAsset {
  name: string;
  svg: string;
  width: number;
  height: number;
}

export interface GameBundle {
  html: string;
  js: string;
  config: {
    title: string;
    version: string;
    supportsMultiplayer: boolean;
    maxPlayers?: number;
    assets: string[];
    audio: string[];
  };
  assets: GeneratedAsset[];
}

export interface PipelineContext {
  sessionId: string;
  userId: string;
  prompt: string;
  concept?: GameConcept;
  gameCode?: string;
  assets?: GeneratedAsset[];
  bundle?: GameBundle;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface PhaseResult {
  phase: GenerationPhase;
  success: boolean;
  error?: string;
}

export type ProgressCallback = (
  phase: GenerationPhase,
  progress: number,
  message: string,
) => void;
