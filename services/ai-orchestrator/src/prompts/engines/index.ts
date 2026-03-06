import type { GameEngine } from '@sloppy/runtime-sdk';
import {
  PHASER3_SYSTEM_PROMPT,
  PHASER3_QUALITY_RULES,
  PHASER3_FORBIDDEN_PATTERNS,
  PHASER3_CDN_URL,
  PHASER3_RESOLUTION,
} from './phaser3.js';
import {
  THREEJS_SYSTEM_PROMPT,
  THREEJS_QUALITY_RULES,
  THREEJS_FORBIDDEN_PATTERNS,
  THREEJS_CDN_URL,
  THREEJS_RESOLUTION,
} from './threejs.js';

export interface EnginePrompt {
  systemPrompt: string;
  qualityRules: string;
  forbiddenPatterns: string;
  cdnUrl: string;
  resolution: { width: number; height: number };
}

const ENGINE_PROMPTS: Record<Exclude<GameEngine, 'canvas2d'>, EnginePrompt> = {
  phaser3: {
    systemPrompt: PHASER3_SYSTEM_PROMPT,
    qualityRules: PHASER3_QUALITY_RULES,
    forbiddenPatterns: PHASER3_FORBIDDEN_PATTERNS,
    cdnUrl: PHASER3_CDN_URL,
    resolution: PHASER3_RESOLUTION,
  },
  threejs: {
    systemPrompt: THREEJS_SYSTEM_PROMPT,
    qualityRules: THREEJS_QUALITY_RULES,
    forbiddenPatterns: THREEJS_FORBIDDEN_PATTERNS,
    cdnUrl: THREEJS_CDN_URL,
    resolution: THREEJS_RESOLUTION,
  },
};

export function getEnginePrompt(engine: GameEngine): EnginePrompt {
  if (engine === 'canvas2d') {
    throw new Error('canvas2d is a legacy v1 engine — v2 code generation requires phaser3 or threejs');
  }

  const prompt = ENGINE_PROMPTS[engine];
  if (!prompt) {
    throw new Error(`Unknown engine: ${engine}`);
  }

  return prompt;
}
