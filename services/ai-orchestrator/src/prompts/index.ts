import type { GameDesignDocument, TechnicalSpec } from '../pipeline/types.js';
import { buildCodeSystemPrompt, buildCodeUserPrompt } from './code.js';

export {
  CONCEPT_SYSTEM_PROMPT,
  buildConceptUserPrompt,
} from './concept.js';

export {
  CODE_SYSTEM_PROMPT,
  buildCodeSystemPrompt,
  buildCodeUserPrompt,
  buildCodeRetryPrompt,
} from './code.js';

export {
  ASSETS_SYSTEM_PROMPT,
  buildAssetsUserPrompt,
} from './assets.js';

export {
  MULTIPLAYER_SYSTEM_PROMPT,
  buildMultiplayerUserPrompt,
} from './multiplayer.js';

export { getEnginePrompt } from './engines/index.js';
export type { EnginePrompt } from './engines/index.js';

export { getGenrePrompt } from './genres/index.js';

export { getScreenPrompts } from './screens/index.js';
export type { ScreenPrompts } from './screens/index.js';

/**
 * Builds the complete code generation prompt pair (system + user).
 *
 * Composition order:
 *   SDK v2 Contract → Engine Prompt → Genre Prompt → Screen Templates →
 *   Quality Rules → Forbidden Patterns → Chain of Thought → Output Format →
 *   GDD Context → Spec Context
 */
export function buildFullCodePrompt(
  gdd: GameDesignDocument,
  spec: TechnicalSpec,
): { system: string; user: string } {
  return {
    system: buildCodeSystemPrompt(gdd, spec),
    user: buildCodeUserPrompt(gdd, spec),
  };
}
