import type { GameGenre } from '@sloppy/runtime-sdk';
import { PLATFORMER_2D_PROMPT } from './platformer-2d.js';
import { TOPDOWN_2D_PROMPT } from './topdown-2d.js';
import { PUZZLE_2D_PROMPT } from './puzzle-2d.js';
import { ARCADE_2D_PROMPT } from './arcade-2d.js';
import { SHOOTER_2D_PROMPT } from './shooter-2d.js';
import { TOWER_DEFENSE_2D_PROMPT } from './tower-defense-2d.js';
import { ENDLESS_RUNNER_2D_PROMPT } from './endless-runner-2d.js';
import { RHYTHM_2D_PROMPT } from './rhythm-2d.js';
import { CARDS_2D_PROMPT } from './cards-2d.js';
import { IDLE_2D_PROMPT } from './idle-2d.js';
import { CUSTOM_2D_PROMPT } from './custom-2d.js';
import { RACING_3D_PROMPT } from './racing-3d.js';
import { FPS_3D_PROMPT } from './fps-3d.js';
import { PUZZLE_3D_PROMPT } from './puzzle-3d.js';
import { ENDLESS_RUNNER_3D_PROMPT } from './endless-runner-3d.js';
import { FLIGHT_3D_PROMPT } from './flight-3d.js';
import { PLATFORMER_3D_PROMPT } from './platformer-3d.js';
import { CUSTOM_3D_PROMPT } from './custom-3d.js';

const GENRE_PROMPTS: Record<GameGenre, string> = {
  '2d-platformer': PLATFORMER_2D_PROMPT,
  '2d-topdown': TOPDOWN_2D_PROMPT,
  '2d-puzzle': PUZZLE_2D_PROMPT,
  '2d-arcade': ARCADE_2D_PROMPT,
  '2d-shooter': SHOOTER_2D_PROMPT,
  '2d-tower-defense': TOWER_DEFENSE_2D_PROMPT,
  '2d-endless-runner': ENDLESS_RUNNER_2D_PROMPT,
  '2d-rhythm': RHYTHM_2D_PROMPT,
  '2d-cards': CARDS_2D_PROMPT,
  '2d-idle': IDLE_2D_PROMPT,
  '2d-custom': CUSTOM_2D_PROMPT,
  '3d-firstperson': FPS_3D_PROMPT,
  '3d-thirdperson': ENDLESS_RUNNER_3D_PROMPT,
  '3d-racing': RACING_3D_PROMPT,
  '3d-puzzle': PUZZLE_3D_PROMPT,
  '3d-flight': FLIGHT_3D_PROMPT,
  '3d-platformer': PLATFORMER_3D_PROMPT,
  '3d-custom': CUSTOM_3D_PROMPT,
};

/**
 * Returns the genre-specific prompt fragment for the given genre.
 * Injected into the code generator system prompt after the engine prompt.
 */
export function getGenrePrompt(genre: GameGenre): string {
  const prompt = GENRE_PROMPTS[genre];
  if (!prompt) {
    throw new Error(`Unknown genre: ${genre}`);
  }
  return prompt;
}
