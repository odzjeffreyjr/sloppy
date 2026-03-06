import type { GameGenre, GameEngine } from './types.js';

export interface GameConcept {
  title: string;
  tagline: string;
  genre: GameGenre;
  engine: GameEngine;
  coreMechanic: string;
  uniqueTwist: string;
  visualStyle: string;
  estimatedComplexity: 'simple' | 'medium';
}

interface BrainstormOptions {
  count: number;
  genreFilter?: GameGenre[];
  genreWeights: Record<string, number>;
  previousConcepts: GameConcept[];
  apiKey: string;
  model?: string;
  provider?: 'openai' | 'anthropic';
}

const SYSTEM_PROMPT = `You are a creative game designer for Sloppy, an AI-powered browser game platform.
Your job is to brainstorm diverse, unique browser game concepts.

Each concept must include:
- title: A catchy, memorable game title (2-4 words)
- tagline: A one-sentence elevator pitch
- genre: One of the valid genre tags
- engine: "phaser3" for 2D games, "threejs" for 3D games
- coreMechanic: The primary gameplay loop in 1-2 sentences
- uniqueTwist: What makes this game stand out
- visualStyle: Brief art direction (colors, aesthetic, vibe)
- estimatedComplexity: "simple" or "medium" only (no complex games)

Valid genres:
2D: 2d-platformer, 2d-topdown, 2d-puzzle, 2d-arcade, 2d-shooter, 2d-tower-defense, 2d-endless-runner, 2d-rhythm, 2d-cards, 2d-idle, 2d-custom
3D: 3d-firstperson, 3d-thirdperson, 3d-racing, 3d-puzzle, 3d-flight, 3d-platformer, 3d-custom

Rules:
- Games must work in a browser with no installation
- Games should be playable in 2-5 minutes
- Titles must be unique and creative — no generic names
- Vary the genres, mechanics, and visual styles across concepts
- Lean toward proven arcade mechanics with creative twists
- Simple games: single mechanic, 1-2 object types
- Medium games: 2-3 mechanics, 3-5 object types, basic progression`;

function buildUserPrompt(
  count: number,
  previousTitles: string[],
  genreFilter?: GameGenre[],
  genreWeights?: Record<string, number>,
): string {
  let prompt = `Generate exactly ${count} unique game concepts as a JSON array.\n`;

  if (genreFilter && genreFilter.length > 0) {
    prompt += `\nOnly use these genres: ${genreFilter.join(', ')}\n`;
  }

  if (genreWeights && Object.keys(genreWeights).length > 0) {
    const weightLines = Object.entries(genreWeights)
      .map(([genre, weight]) => `  ${genre}: ${Math.round(weight * 100)}%`)
      .join('\n');
    prompt += `\nApproximate genre distribution:\n${weightLines}\n`;
  }

  if (previousTitles.length > 0) {
    const recentTitles = previousTitles.slice(-20);
    prompt += `\nAvoid repeating or being too similar to these previously generated titles:\n${recentTitles.map((t) => `- ${t}`).join('\n')}\n`;
  }

  prompt += `\nRespond with ONLY a valid JSON array of ${count} concept objects, no markdown fences or explanations.`;
  return prompt;
}

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  model: string,
  provider: 'openai' | 'anthropic',
): Promise<string> {
  if (provider === 'anthropic') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Anthropic API error ${resp.status}: ${text}`);
    }

    const data = (await resp.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    return data.content[0]?.text ?? '';
  }

  // OpenAI-compatible (also works for Grok via base URL override)
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 4096,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OpenAI API error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? '';
}

function parseConceptsFromResponse(raw: string): GameConcept[] {
  let cleaned = raw.trim();

  // Strip markdown code fences if the LLM added them despite instructions
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array of concepts');
  }

  return parsed.map((item: Record<string, unknown>) => ({
    title: String(item.title ?? ''),
    tagline: String(item.tagline ?? ''),
    genre: String(item.genre ?? '2d-arcade') as GameGenre,
    engine: String(item.engine ?? 'phaser3') as GameEngine,
    coreMechanic: String(item.coreMechanic ?? ''),
    uniqueTwist: String(item.uniqueTwist ?? ''),
    visualStyle: String(item.visualStyle ?? ''),
    estimatedComplexity: item.estimatedComplexity === 'medium' ? 'medium' : 'simple',
  }));
}

const VALID_GENRES = new Set<string>([
  '2d-platformer', '2d-topdown', '2d-puzzle', '2d-arcade', '2d-shooter',
  '2d-tower-defense', '2d-endless-runner', '2d-rhythm', '2d-cards', '2d-idle', '2d-custom',
  '3d-firstperson', '3d-thirdperson', '3d-racing', '3d-puzzle', '3d-flight', '3d-platformer', '3d-custom',
]);

function validateConcept(concept: GameConcept): boolean {
  if (!concept.title || concept.title.length < 2) return false;
  if (!concept.tagline) return false;
  if (!VALID_GENRES.has(concept.genre)) return false;
  if (concept.engine !== 'phaser3' && concept.engine !== 'threejs') return false;
  if (!concept.coreMechanic) return false;
  return true;
}

/**
 * Brainstorm game concepts using an LLM. Generates in batches of 10
 * and deduplicates against previous titles.
 */
export async function brainstormConcepts(options: BrainstormOptions): Promise<GameConcept[]> {
  const {
    count,
    genreFilter,
    genreWeights,
    previousConcepts,
    apiKey,
    model = 'gpt-4o-mini',
    provider = 'openai',
  } = options;

  const allConcepts: GameConcept[] = [];
  const seenTitles = new Set(previousConcepts.map((c) => c.title.toLowerCase()));
  const batchSize = 10;
  // Guard against infinite loops when the LLM keeps returning
  // invalid or duplicate concepts.
  const maxBatches = Math.ceil(count / batchSize) * 3;
  let batchAttempts = 0;

  let remaining = count;
  while (remaining > 0 && batchAttempts < maxBatches) {
    batchAttempts++;
    const batchCount = Math.min(batchSize, remaining);

    const previousTitles = [
      ...previousConcepts.map((c) => c.title),
      ...allConcepts.map((c) => c.title),
    ];

    const userPrompt = buildUserPrompt(batchCount, previousTitles, genreFilter, genreWeights);

    const raw = await callLLM(SYSTEM_PROMPT, userPrompt, apiKey, model, provider);

    let concepts: GameConcept[];
    try {
      concepts = parseConceptsFromResponse(raw);
    } catch {
      // Retry once on parse failure
      const retryRaw = await callLLM(SYSTEM_PROMPT, userPrompt, apiKey, model, provider);
      concepts = parseConceptsFromResponse(retryRaw);
    }

    let addedThisBatch = 0;
    for (const concept of concepts) {
      if (remaining <= 0) break;

      if (!validateConcept(concept)) continue;

      const titleKey = concept.title.toLowerCase();
      if (seenTitles.has(titleKey)) continue;

      // Ensure engine matches genre dimension
      if (concept.genre.startsWith('3d-')) {
        concept.engine = 'threejs';
      } else {
        concept.engine = 'phaser3';
      }

      seenTitles.add(titleKey);
      allConcepts.push(concept);
      remaining--;
      addedThisBatch++;
    }

    // If a batch produced zero usable concepts, we're likely stuck
    if (addedThisBatch === 0 && batchAttempts > Math.ceil(count / batchSize)) {
      break;
    }
  }

  return allConcepts;
}
