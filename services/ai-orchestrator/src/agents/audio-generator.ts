import { createLogger } from '@sloppy/logger';
import {
  getZzfxInlineSource,
  getSFXInlineSource,
  getAudioManagerInlineSource,
} from '@sloppy/runtime-sdk';
import type { LLMClient, LLMResponse } from '../llm/index.js';
import type { GameDesignDocument, ProgressCallback } from '../pipeline/types.js';

const log = createLogger('audio-generator');

// ---------------------------------------------------------------------------
// Inline source snippets (from runtime-sdk, used for injection into game HTML)
// ---------------------------------------------------------------------------

const ZZFX_MICRO_SNIPPET = getZzfxInlineSource();
const SFX_PRESETS_SOURCE = getSFXInlineSource();
const AUDIO_MANAGER_SNIPPET = getAudioManagerInlineSource();

// ---------------------------------------------------------------------------
// System prompt for ZzFX audio injection
// ---------------------------------------------------------------------------

function buildZzfxSystemPrompt(gdd: GameDesignDocument): string {
  const engineName = gdd.engine === 'phaser3' ? 'Phaser 3' : 'Three.js';

  return `You are an audio integration specialist for browser games. Your job is to inject procedural sound effects into an existing, working game.

## Your Task

You will receive the complete HTML source of a working ${engineName} game. You must:

1. Add the ZzFX micro sound engine snippet at the top of the game's inline script
2. Add the SFX preset map after the ZzFX engine
3. Add the AudioManager factory after the SFX presets
4. Initialize the AudioManager: \`const audioManager = createAudioManager();\`
5. Add \`zzfx(...SFX.xxx)\` calls at the right places in the game code to play sounds

## Available Sound Presets

\`\`\`javascript
${SFX_PRESETS_SOURCE}
\`\`\`

## Sound Mapping Rules

Every game MUST have at minimum these sounds:
- **Movement/Action**: jump, dash, walk — play on player movement actions
- **Combat/Interaction**: shoot, hit, explosion — play on attacks and collisions
- **Collection**: coin, powerUp — play on item/score pickup
- **UI**: select, confirm, back — play on menu interactions
- **State Changes**: levelUp, gameOver — play on level completion and game over

Map game events to the closest matching preset. For example:
- Player jumps → \`zzfx(...SFX.jump)\`
- Enemy destroyed → \`zzfx(...SFX.explosion)\`
- Score point → \`zzfx(...SFX.coin)\`
- Take damage → \`zzfx(...SFX.hit)\`
- Game over → \`zzfx(...SFX.gameOver)\`
- Level complete → \`zzfx(...SFX.levelUp)\`
- Button click → \`zzfx(...SFX.select)\`
- Start game → \`zzfx(...SFX.confirm)\`

For 3D games, also consider:
- Vehicle/engine sounds → \`zzfx(...SFX.engineRev)\`
- Physical collisions → \`zzfx(...SFX.impact)\`

## AudioManager Integration

Initialize the AudioManager after the ZzFX engine and SFX presets:
\`\`\`javascript
const audioManager = createAudioManager();
\`\`\`

Wire it into the game lifecycle:
- In \`pause()\`: call \`audioManager.onPause()\`
- In \`resume()\`: call \`audioManager.onResume()\`
- In \`destroy()\`: call \`audioManager.onDestroy()\`

You can use either \`audioManager.play('jump')\` or \`zzfx(...SFX.jump)\` — both work.
The AudioManager adds pause/resume/mute support and the postMessage bridge for feed integration.

## Critical Rules

1. **DO NOT rewrite the game** — only ADD audio code. Keep all existing game logic, visuals, and SDK contract intact.
2. **DO NOT change the SDK contract** — \`window.SloppyGame\` and \`window.game\` assignments must remain unchanged.
3. **DO NOT break any existing functionality** — the game must still pass validation after audio injection.
4. **DO NOT auto-play audio** — audio context is created on first user interaction (browser policy). ZzFX handles this automatically.
5. **DO NOT use \`new Audio()\` or raw \`AudioContext\`** — use only the provided ZzFX function and AudioManager.
6. **DO NOT add external script tags or fetch calls** — all audio code is inline.
7. The ZzFX snippet, SFX presets, and AudioManager MUST be placed INSIDE the existing \`<script>\` tag, before the game code.
8. Place sound calls at natural game events — collisions, scoring, state changes, button interactions.

## Output Format

Output the COMPLETE modified HTML file starting with \`<!DOCTYPE html>\`.
Include ALL existing code with the audio additions. Do not remove or modify any non-audio code.
Output ONLY the HTML. No markdown fences, no explanations.`;
}

function buildZzfxUserPrompt(
  code: string,
  gdd: GameDesignDocument,
): string {
  return `Inject ZzFX procedural sound effects into this ${gdd.engine === 'phaser3' ? 'Phaser 3' : 'Three.js'} game.

## Game Context
**Title:** ${gdd.title}
**Genre:** ${gdd.genre}
**Core Mechanic:** ${gdd.coreMechanic}
**Game Objects:** ${gdd.objects.map((o) => o.name).join(', ')}

## Audio Snippets to Inject

### 1. ZzFX Micro Engine (place at top of inline script)
\`\`\`javascript
${ZZFX_MICRO_SNIPPET}
\`\`\`

### 2. SFX Presets (place after ZzFX engine)
\`\`\`javascript
${SFX_PRESETS_SOURCE}
\`\`\`

### 3. AudioManager Factory (place after SFX presets)
\`\`\`javascript
${AUDIO_MANAGER_SNIPPET}
\`\`\`

### 4. Initialize AudioManager
\`\`\`javascript
const audioManager = createAudioManager();
\`\`\`

## Current Game Code

${code}

Add sound effects at all appropriate game events. Wire audioManager.onPause(), audioManager.onResume(), and audioManager.onDestroy() into the game lifecycle methods.
Return the complete modified HTML.`;
}

// ---------------------------------------------------------------------------
// ElevenLabs mode types (for future implementation)
// ---------------------------------------------------------------------------

export interface AudioFile {
  name: string;
  data: Buffer;
  mimeType: string;
}

export interface AudioGeneratorResult {
  code: string;
  audioFiles?: AudioFile[];
  usage: LLMResponse['usage'];
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

function stripMarkdownFences(text: string): string {
  let result = text.trim();
  if (result.startsWith('```')) {
    const firstNewline = result.indexOf('\n');
    if (firstNewline !== -1) {
      result = result.slice(firstNewline + 1);
    }
  }
  if (result.endsWith('```')) {
    result = result.slice(0, -3).trimEnd();
  }
  return result;
}

/**
 * Run the audio generator agent.
 *
 * - **zzfx mode** (default): Uses LLM to inject ZzFX procedural audio + AudioManager into game code.
 * - **elevenlabs mode**: Generates real audio files via ElevenLabs API (future implementation).
 */
export async function runAudioGenerator(
  code: string,
  gdd: GameDesignDocument,
  mode: 'zzfx' | 'elevenlabs',
  llm: LLMClient,
  onProgress: ProgressCallback,
  maxTokens = 12000,
): Promise<AudioGeneratorResult> {
  if (mode === 'elevenlabs') {
    return runElevenLabsMode(code, gdd, onProgress);
  }

  return runZzfxMode(code, gdd, llm, onProgress, maxTokens);
}

// ---------------------------------------------------------------------------
// ZzFX mode — LLM injects procedural audio into game code
// ---------------------------------------------------------------------------

async function runZzfxMode(
  code: string,
  gdd: GameDesignDocument,
  llm: LLMClient,
  onProgress: ProgressCallback,
  maxTokens: number,
): Promise<AudioGeneratorResult> {
  onProgress('audio', 10, 'Analyzing game for audio injection points…');

  const systemPrompt = buildZzfxSystemPrompt(gdd);
  const userPrompt = buildZzfxUserPrompt(code, gdd);

  onProgress('audio', 30, 'Injecting ZzFX sound effects…');

  const response = await llm.generateText(systemPrompt, userPrompt, maxTokens);
  let injectedCode = stripMarkdownFences(response.content);

  // Safety checks — ensure the SDK contract is still intact
  if (!injectedCode.includes('window.SloppyGame') || !injectedCode.includes('window.game')) {
    log.warn('Audio injection broke SDK contract — falling back to original code');
    onProgress('audio', 100, 'Audio injection failed safety check — using original code');
    return { code, usage: response.usage };
  }

  if (!injectedCode.includes('<!DOCTYPE html>') && !injectedCode.includes('<!doctype html>')) {
    log.warn('Audio injection output missing DOCTYPE — falling back to original code');
    onProgress('audio', 100, 'Audio injection failed safety check — using original code');
    return { code, usage: response.usage };
  }

  // Verify ZzFX was actually injected
  if (!injectedCode.includes('zzfx') && !injectedCode.includes('ZzFX')) {
    log.warn('Audio injection output missing ZzFX code — falling back to original code');
    onProgress('audio', 100, 'Audio injection incomplete — using original code');
    return { code, usage: response.usage };
  }

  log.info('ZzFX audio injection completed successfully');
  onProgress('audio', 100, 'Sound effects added');

  return {
    code: injectedCode,
    usage: response.usage,
  };
}

// ---------------------------------------------------------------------------
// ElevenLabs mode — generates real audio files (placeholder for future)
// ---------------------------------------------------------------------------

async function runElevenLabsMode(
  code: string,
  gdd: GameDesignDocument,
  onProgress: ProgressCallback,
): Promise<AudioGeneratorResult> {
  // ElevenLabs mode requires the ELEVENLABS_API_KEY env var and will be
  // implemented when the creator subscription tier launches. For now,
  // we skip and return the code unchanged.
  log.info('ElevenLabs audio mode — not yet implemented, skipping');
  onProgress('audio', 100, 'ElevenLabs audio generation not yet available — skipping');

  return {
    code,
    audioFiles: [],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  };
}
