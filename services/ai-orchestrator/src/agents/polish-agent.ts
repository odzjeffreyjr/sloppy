import { createLogger } from '@sloppy/logger';
import type { LLMClient } from '../llm/index.js';
import type { GameDesignDocument, ProgressCallback } from '../pipeline/types.js';

const log = createLogger('polish-agent');

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

function buildPolishSystemPrompt(gdd: GameDesignDocument): string {
  const engineName =
    gdd.engine === 'phaser3' ? 'Phaser 3' : 'Three.js';

  const engineTips =
    gdd.engine === 'phaser3'
      ? `### Phaser 3 Polish Techniques
- Add particle emitters on scoring events and collisions (this.add.particles with emitZone/deathZone)
- Use tweens for smooth transitions: scale bounce on collect, alpha fade on screen changes
- Camera effects: this.cameras.main.shake() on damage, flash() on power-up
- Add screen shake with configurable intensity and duration
- Smooth score counter that tweens from old to new value
- Button hover effects with setScale tween
- Background gradient or animated tile sprite
- Text shadow effects using setShadow()
- Use time.addEvent for staggered spawn animations`
      : `### Three.js Polish Techniques
- Add particle systems using BufferGeometry with dynamic vertex positions for scoring events
- Smooth camera transitions with lerp (position.lerp, quaternion.slerp)
- Emissive pulse on collectibles using sin(time) on emissiveIntensity
- Screen flash via a fullscreen quad with fading opacity
- Fog color transitions on level change
- Object scale bounce using sin(time) for idle animations
- Shadow quality: PCFSoftShadowMap, cascaded shadow maps for large scenes
- Tone mapping: ACESFilmicToneMapping with exposure control
- Post-processing feel: bloom-like glow via emissive materials`;

  return `You are the Polish agent for Sloppy, an AI browser game platform. Your job is to improve the VISUAL QUALITY and GAME FEEL of a working game.

## Rules
1. DO NOT change game logic, scoring, state machine, or win/lose conditions.
2. DO NOT break the SDK v2 contract — all 12 methods, metadata, and window.game must remain intact.
3. DO NOT add external asset loading — all visuals must remain procedural.
4. Return the COMPLETE polished HTML file starting with \`<!DOCTYPE html>\`.
5. No markdown fences, no explanations. Just the HTML.

## What to Improve
- **Color palette**: Harmonious colors, better contrast, gradient backgrounds
- **Animation smoothness**: Ease-in/out transitions, bounce effects on interactions
- **Particle effects**: Add particles on collisions, scoring, game-over
- **Screen transitions**: Fade between states, slide-in text
- **Juice effects**: Screen shake on damage, flash on power-up, scale pulse on collect
- **HUD polish**: Smooth score counter, subtle shadows, better typography
- **Intro screen**: Animated title, pulsing start prompt
- **Game-over screen**: Dramatic entrance animation, high-score celebration

## Engine: ${engineName}
${engineTips}

## Game Info
- **Title:** ${gdd.title}
- **Genre:** ${gdd.genre}
- **Visual Style:** ${gdd.visualStyle}

Keep the game fully functional. Only enhance aesthetics and feel.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runPolishAgent(
  code: string,
  gdd: GameDesignDocument,
  llm: LLMClient,
  onProgress: ProgressCallback,
  maxTokens: number,
): Promise<{ code: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  log.info({ title: gdd.title, engine: gdd.engine }, 'Running polish pass');

  onProgress('polishing', 10, 'Polishing visuals and game feel…');

  const systemPrompt = buildPolishSystemPrompt(gdd);
  const userPrompt = `Polish the following working game. Improve visual quality and game feel without changing gameplay logic.

## Current Working Code

${code}

Return the COMPLETE polished HTML file. No markdown fences, no explanations.`;

  const response = await llm.generateText(
    systemPrompt,
    userPrompt,
    maxTokens,
  );

  let polished = response.content.trim();

  const fenceMatch = polished.match(/```(?:html|javascript|js)?\s*\n([\s\S]*?)\n```/i);
  if (fenceMatch) {
    polished = fenceMatch[1].trim();
  } else {
    polished = polished
      .replace(/^```(?:html|javascript|js)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
  }

  // Sanity check: if polish broke the contract, fall back to original
  if (
    !polished.includes('window.SloppyGame') ||
    (!polished.includes('<!DOCTYPE html') && !polished.includes('<!doctype html'))
  ) {
    log.warn('Polish output missing SloppyGame or DOCTYPE — falling back to original code');
    onProgress('polishing', 100, 'Polish skipped (output invalid)');
    return { code, usage: response.usage };
  }

  onProgress('polishing', 100, 'Polish pass complete');

  return {
    code: polished,
    usage: response.usage,
  };
}
