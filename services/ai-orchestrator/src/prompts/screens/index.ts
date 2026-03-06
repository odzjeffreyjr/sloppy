import { INTRO_SCREEN_PROMPT } from './intro.js';
import { PAUSE_SCREEN_PROMPT } from './pause.js';
import { GAMEOVER_SCREEN_PROMPT } from './gameover.js';
import { HUD_SCREEN_PROMPT } from './hud.js';

export interface ScreenPrompts {
  intro: string;
  pause: string;
  gameover: string;
  hud: string;
}

/**
 * Returns all screen rendering template prompts.
 * These are injected into the code generator to guide how each game screen should be rendered.
 */
export function getScreenPrompts(): ScreenPrompts {
  return {
    intro: INTRO_SCREEN_PROMPT,
    pause: PAUSE_SCREEN_PROMPT,
    gameover: GAMEOVER_SCREEN_PROMPT,
    hud: HUD_SCREEN_PROMPT,
  };
}
