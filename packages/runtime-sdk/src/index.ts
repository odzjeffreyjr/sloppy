// V2 contract & types (primary)
export type {
  SloppyGameV2,
  GameConfig,
  GameEngine,
  GameGenre,
  GameState,
  GameInitConfig,
  GameMetadata,
  GameResult,
  ControlHint,
  MultiplayerHooks,
} from './types.js';

// V1 backward-compatibility
export type { SloppyGameV1, SloppyGame } from './types.js';

// Validation
export { validateGameModule, validateGameModuleV1, validateGameSource } from './validator.js';
export type { ValidationResult } from './validator.js';

// Loader
export { GameLoader } from './loader.js';
export type { LoaderOptions } from './loader.js';

// Config schema
export { gameConfigSchema } from './schema.js';

// V2 utilities
export { GameStateManager } from './v2/state-manager.js';
export { CanvasScreenRenderer, HtmlScreenRenderer } from './v2/screen-renderer.js';
export type { ScreenStyle } from './v2/screen-renderer.js';
export { Canvas2DEffects, ThreeJSEffects } from './v2/effects-library.js';
export type { Canvas2DEffectsTarget } from './v2/effects-library.js';

// V2 touch controls
export { TouchControls, getTouchConfigForGenre, getTouchControlsInlineSource } from './v2/touch-controls.js';
export type { TouchControlConfig, TouchControlType, TouchLayout, TouchInput } from './v2/touch-controls.js';

// V2 audio
export { SFX, getSFXInlineSource } from './v2/audio/zzfx-presets.js';
export type { ZzFXParams, SFXKey } from './v2/audio/zzfx-presets.js';
export { zzfx, getZzfxInlineSource } from './v2/audio/zzfx-micro.js';
export { createAudioManager, getAudioManagerInlineSource } from './v2/audio/audio-manager.js';
export type { AudioManager, AudioManagerOptions } from './v2/audio/audio-manager.js';

// Template paths (for AI orchestrator to reference)
export const TEMPLATE_PATHS = {
  '3d': {
    fps: new URL('./templates/3d/fps.js', import.meta.url).pathname,
    racing: new URL('./templates/3d/racing.js', import.meta.url).pathname,
    'endless-runner': new URL('./templates/3d/endless-runner.js', import.meta.url).pathname,
    'puzzle-3d': new URL('./templates/3d/puzzle-3d.js', import.meta.url).pathname,
    'tower-defense-3d': new URL('./templates/3d/tower-defense-3d.js', import.meta.url).pathname,
    flight: new URL('./templates/3d/flight.js', import.meta.url).pathname,
    'platformer-3d': new URL('./templates/3d/platformer-3d.js', import.meta.url).pathname,
  },
  '2d': {
    platformer: new URL('./templates/2d/platformer.js', import.meta.url).pathname,
    topdown: new URL('./templates/2d/topdown.js', import.meta.url).pathname,
    puzzle: new URL('./templates/2d/puzzle.js', import.meta.url).pathname,
    arcade: new URL('./templates/2d/arcade.js', import.meta.url).pathname,
    shooter: new URL('./templates/2d/shooter.js', import.meta.url).pathname,
    'tower-defense': new URL('./templates/2d/tower-defense.js', import.meta.url).pathname,
    'endless-runner': new URL('./templates/2d/endless-runner.js', import.meta.url).pathname,
    rhythm: new URL('./templates/2d/rhythm.js', import.meta.url).pathname,
    cards: new URL('./templates/2d/cards.js', import.meta.url).pathname,
    idle: new URL('./templates/2d/idle.js', import.meta.url).pathname,
  },
} as const;

export const GENRE_TO_TEMPLATE: Record<string, string | undefined> = {
  '3d-firstperson': 'fps',
  '3d-racing': 'racing',
  '3d-thirdperson': 'endless-runner',
  '3d-puzzle': 'puzzle-3d',
  '3d-flight': 'flight',
  '3d-platformer': 'platformer-3d',
  '2d-platformer': 'platformer',
  '2d-topdown': 'topdown',
  '2d-puzzle': 'puzzle',
  '2d-arcade': 'arcade',
  '2d-shooter': 'shooter',
  '2d-tower-defense': 'tower-defense',
  '2d-endless-runner': 'endless-runner',
  '2d-rhythm': 'rhythm',
  '2d-cards': 'cards',
  '2d-idle': 'idle',
};
