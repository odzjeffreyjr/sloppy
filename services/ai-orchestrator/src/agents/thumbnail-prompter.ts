import { createLogger } from '@sloppy/logger';
import type { LLMClient, LLMResponse } from '../llm/index.js';
import type { GameDesignDocument, ProgressCallback } from '../pipeline/types.js';

const log = createLogger('thumbnail-prompter');

const GENRE_VISUAL_ARCHETYPES: Record<string, string> = {
  '2d-platformer': 'Side-view action pose mid-jump, colorful layered backgrounds, floating platforms and collectibles',
  '2d-topdown': 'Overhead view of the arena/map, character centered with enemies surrounding, stylized ground textures',
  '2d-puzzle': 'Clean geometric arrangement, satisfying color-matched patterns, pieces in motion with glow effects',
  '2d-arcade': 'Dynamic action moment with projectiles flying, score counter visible, retro-inspired neon glow',
  '2d-shooter': 'Dramatic bullet-hell moment, player ship centered, enemy formations above, projectile trails',
  '2d-tower-defense': 'Bird\'s-eye view of fortified path, towers firing at approaching waves, strategic overlay feel',
  '2d-endless-runner': 'Side-view sprint with motion blur, character leaping over obstacle, parallax scenery rushing past',
  '2d-rhythm': 'Musical notes cascading down lanes, hit zone glowing, combo counter prominent, stage-light atmosphere',
  '2d-cards': 'Fanned hand of illustrated cards on a felt table, one card played with a magical effect burst',
  '2d-idle': 'Whimsical resource-generation scene, floating numbers, generators and upgrades displayed prominently',
  '2d-custom': 'Dynamic 2D game scene with vibrant colors, stylized characters, and eye-catching visual effects',
  '3d-racing': 'Dramatic low-angle camera behind vehicle on track, speed lines and motion blur, scenic backdrop',
  '3d-firstperson': 'First-person perspective down a corridor, weapon visible, dramatic lighting and depth of field',
  '3d-puzzle': 'Cinematic depth of field, glowing puzzle pieces in 3D space, ambient volumetric lighting',
  '3d-thirdperson': 'Third-person chase camera, character running toward camera with obstacles ahead, dramatic sky',
  '3d-flight': 'Dramatic banking angle of aircraft/spacecraft against starfield or clouds, engine glow trailing',
  '3d-platformer': 'Third-person camera showing character mid-jump between colorful floating platforms, scenic vista below',
  '3d-custom': 'Cinematic 3D scene with dramatic lighting, depth of field, and volumetric atmosphere',
};

function buildThumbnailSystemPrompt(): string {
  return `You are a thumbnail prompt specialist for game marketing visuals. Your job is to write a single, highly-detailed image generation prompt optimized for FLUX (a diffusion model).

## Output Requirements

- Output a SINGLE image generation prompt string (100–200 words).
- The prompt must describe a **marketing-quality game thumbnail**, NOT a screenshot.
- Style: vibrant, eye-catching, professional game store artwork.
- The image will be 16:9 landscape (1280×720).
- Do NOT include any text in the prompt (title and genre badge will be overlaid later via Sharp.js).
- Do NOT mention UI elements, HUD, menus, or buttons.

## Prompt Writing Guidelines

1. **Subject first**: Describe the main subject/character/scene prominently.
2. **Action**: Show a dynamic moment — mid-action, dramatic pose, key gameplay moment.
3. **Composition**: Describe camera angle, framing, focal point. Leave bottom 20% relatively clear (text overlay zone).
4. **Lighting**: Specify dramatic, cinematic lighting. Use rim lighting, volumetric rays, or glow effects.
5. **Color palette**: Use vibrant, saturated colors appropriate to the genre and visual style.
6. **Background**: Describe environmental context — skybox, terrain, atmosphere, particle effects.
7. **Style descriptors**: Include 3–5 style keywords at the end (e.g., "digital painting, game art, vibrant colors, cinematic lighting, 4K").

## Genre-Specific Visual Archetypes

Use these as starting points, then customize based on the specific game:

${Object.entries(GENRE_VISUAL_ARCHETYPES)
  .map(([genre, desc]) => `- **${genre}**: ${desc}`)
  .join('\n')}

Output ONLY the prompt string. No explanations, no markdown, no quotes around it.`;
}

function buildThumbnailUserPrompt(gdd: GameDesignDocument): string {
  const objectsList = gdd.objects.map((o) => `${o.name}: ${o.description}`).join('\n  ');

  return `Generate a FLUX image prompt for a game store thumbnail.

**Title:** ${gdd.title}
**Genre:** ${gdd.genre}
**Engine:** ${gdd.engine === 'phaser3' ? '2D (Phaser 3)' : '3D (Three.js)'}
**Visual Style:** ${gdd.visualStyle}
**Core Mechanic:** ${gdd.coreMechanic}
**Logline:** ${gdd.logline}
**Game Objects:**
  ${objectsList}

Write a single FLUX-optimized prompt (100–200 words) describing a marketing-quality thumbnail for this specific game.`;
}

export interface ThumbnailPromptResult {
  prompt: string;
  usage: LLMResponse['usage'];
}

/**
 * Uses the LLM to generate an optimized image prompt for FLUX,
 * based on the game's GDD (title, genre, visual style, objects).
 */
export async function runThumbnailPrompter(
  gdd: GameDesignDocument,
  llm: LLMClient,
  onProgress: ProgressCallback,
  maxTokens = 500,
): Promise<ThumbnailPromptResult> {
  onProgress('thumbnail', 10, 'Generating thumbnail concept…');

  const systemPrompt = buildThumbnailSystemPrompt();
  const userPrompt = buildThumbnailUserPrompt(gdd);

  const response = await llm.generateText(systemPrompt, userPrompt, maxTokens);

  let prompt = response.content.trim();

  // Strip any markdown fences or surrounding quotes the LLM may have added
  if (prompt.startsWith('```')) {
    const firstNewline = prompt.indexOf('\n');
    if (firstNewline !== -1) prompt = prompt.slice(firstNewline + 1);
  }
  if (prompt.endsWith('```')) {
    prompt = prompt.slice(0, -3).trimEnd();
  }
  if ((prompt.startsWith('"') && prompt.endsWith('"')) || (prompt.startsWith("'") && prompt.endsWith("'"))) {
    prompt = prompt.slice(1, -1);
  }

  log.info({ title: gdd.title, promptLength: prompt.length }, 'Thumbnail prompt generated');
  onProgress('thumbnail', 30, 'Thumbnail concept ready');

  return { prompt, usage: response.usage };
}
