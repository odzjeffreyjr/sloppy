import { createLogger } from '@sloppy/logger';
import type { LLMClient } from '../llm/index.js';
import type {
  GameDesignDocument,
  TechnicalSpec,
  ProgressCallback,
} from '../pipeline/types.js';

const log = createLogger('debug-fixer');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationError {
  check: string;
  message: string;
}

export interface RuntimeError {
  phase: string;
  message: string;
}

export interface DebugContext {
  gdd: GameDesignDocument;
  spec: TechnicalSpec;
  currentCode: string;
  validationErrors: ValidationError[];
  runtimeErrors: RuntimeError[];
  screenshots: Record<string, string>;
  iterationCount: number;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

function buildDebugSystemPrompt(ctx: DebugContext): string {
  const engineName =
    ctx.gdd.engine === 'phaser3' ? 'Phaser 3' : 'Three.js';

  return `You are the Debug & Fix agent for Sloppy, an AI browser game platform. Your job is to FIX broken game code, NOT rewrite it from scratch.

## Your Role
You receive a game that failed validation along with specific errors and screenshots. You must apply TARGETED fixes — preserve all working code and only change what is broken.

## Rules
1. FIX ONLY the failing parts. Do NOT rewrite the entire game.
2. Return the COMPLETE corrected HTML file (not a diff).
3. Output starts with \`<!DOCTYPE html>\` — no markdown fences, no explanations.
4. Preserve the game's visual style, scoring, and progression logic.
5. Ensure \`window.SloppyGame\` and \`window.game\` are both assigned with all 12 required methods, \`metadata\`, and \`supportsMultiplayer\`.
6. After \`init()\` resolves, the game MUST call: \`window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');\`

## SDK v2 Required State Machine
States: idle → intro → playing → paused → gameover
- \`init(container, config)\` → sets up engine, renders intro, state = 'idle' or 'intro'
- \`start()\` → begins gameplay, state = 'playing'
- \`pause()\` → freezes game loop, shows pause overlay, state = 'paused'
- \`resume()\` → unfreezes game loop, hides overlay, state = 'playing'
- \`restart()\` → resets score/objects, state = 'playing'
- \`renderGameOverScreen(score)\` → displays game-over screen, state = 'gameover'
- \`getState()\` → returns current state string
- \`getScore()\` → returns { score, timeElapsed, level?, customData? }
- \`renderIntroScreen()\` → displays intro/title screen
- \`renderPauseScreen()\` → displays pause overlay
- \`renderHUD()\` → updates HUD display

## Common Fix Patterns
- **Missing method**: Add the missing method with appropriate implementation for ${engineName}
- **State not transitioning**: Ensure the internal state variable is updated in every lifecycle method
- **Blank screen on pause/gameover**: Ensure overlay elements are created and made visible
- **Console errors (undefined refs)**: Check that variables are declared before use, objects exist before property access
- **\`sloppy:game:ready\` not firing**: Add the postMessage at the end of \`init()\`
- **\`window.game\` not set**: Add \`window.game = window.SloppyGame;\` after assignment

## Engine: ${engineName}
${ctx.gdd.engine === 'phaser3' ? 'Use Phaser 3 APIs: Scene architecture, Arcade Physics, Graphics + generateTexture, Tweens, Text.' : 'Use Three.js APIs: Scene, Camera, Renderer, Mesh, Box3 collision, requestAnimationFrame loop.'}

## This is iteration ${ctx.iterationCount}. Focus on precision, not creativity.`;
}

function buildDebugUserPrompt(ctx: DebugContext): string {
  const sections: string[] = [];

  sections.push('## Errors to Fix\n');

  if (ctx.validationErrors.length > 0) {
    sections.push('### Static Validation Errors');
    for (const err of ctx.validationErrors) {
      sections.push(`- [${err.check}] ${err.message}`);
    }
    sections.push('');
  }

  if (ctx.runtimeErrors.length > 0) {
    sections.push('### Runtime Errors');
    for (const err of ctx.runtimeErrors) {
      sections.push(`- [during ${err.phase}] ${err.message}`);
    }
    sections.push('');
  }

  sections.push(`## Game Context`);
  sections.push(`**Title:** ${ctx.gdd.title}`);
  sections.push(`**Engine:** ${ctx.gdd.engine}`);
  sections.push(`**Genre:** ${ctx.gdd.genre}`);
  sections.push(`**Core Mechanic:** ${ctx.gdd.coreMechanic}`);
  sections.push(`**Controls:** ${ctx.gdd.controls.map((c) => `${c.key} → ${c.action}`).join(', ')}`);
  sections.push('');

  sections.push('## SDK v2 Lifecycle Mapping');
  sections.push(`- **init:** ${ctx.spec.sdkV2Mapping.init}`);
  sections.push(`- **start:** ${ctx.spec.sdkV2Mapping.start}`);
  sections.push(`- **pause:** ${ctx.spec.sdkV2Mapping.pause}`);
  sections.push(`- **resume:** ${ctx.spec.sdkV2Mapping.resume}`);
  sections.push(`- **restart:** ${ctx.spec.sdkV2Mapping.restart}`);
  sections.push(`- **destroy:** ${ctx.spec.sdkV2Mapping.destroy}`);
  sections.push('');

  const screenshotEntries = Object.entries(ctx.screenshots);
  if (screenshotEntries.length > 0) {
    sections.push('## Screenshots (base64 PNG)\n');
    for (const [state, b64] of screenshotEntries) {
      sections.push(`### ${state}`);
      sections.push(`![${state} screenshot](data:image/png;base64,${b64})\n`);
    }
  }

  sections.push('## Current Code (with errors)\n');
  sections.push(ctx.currentCode);

  sections.push(
    '\n\nFix ALL errors listed above. Output ONLY the corrected HTML. No markdown fences.',
  );

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runDebugFixer(
  ctx: DebugContext,
  llm: LLMClient,
  onProgress: ProgressCallback,
  maxTokens: number,
): Promise<{ code: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  const errorSummary = [
    ...ctx.validationErrors.map((e) => e.message),
    ...ctx.runtimeErrors.map((e) => e.message),
  ].join('; ');

  log.info(
    { iteration: ctx.iterationCount, errorCount: ctx.validationErrors.length + ctx.runtimeErrors.length },
    `Debug fixer iteration ${ctx.iterationCount}: ${errorSummary.slice(0, 200)}`,
  );

  onProgress('fixing', 10, `Fixing errors (attempt ${ctx.iterationCount})…`);

  const systemPrompt = buildDebugSystemPrompt(ctx);
  const userPrompt = buildDebugUserPrompt(ctx);

  const response = await llm.generateText(
    systemPrompt,
    userPrompt,
    maxTokens,
  );

  let code = response.content.trim();

  // Strip markdown fences if the model wrapped the output
  const fenceMatch = code.match(/```(?:html|javascript|js)?\s*\n([\s\S]*?)\n```/i);
  if (fenceMatch) {
    code = fenceMatch[1].trim();
  } else {
    code = code
      .replace(/^```(?:html|javascript|js)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
  }

  onProgress('fixing', 90, `Fix applied (attempt ${ctx.iterationCount})`);

  return {
    code,
    usage: response.usage,
  };
}
