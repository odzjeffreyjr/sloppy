/** Result returned by the runtime validator. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// V2 required methods / properties
// ---------------------------------------------------------------------------

const V2_REQUIRED_METHODS = [
  'init',
  'destroy',
  'start',
  'pause',
  'resume',
  'restart',
  'renderIntroScreen',
  'renderPauseScreen',
  'renderGameOverScreen',
  'renderHUD',
  'getState',
  'getScore',
] as const;

const MULTIPLAYER_METHODS = [
  'getInitialState',
  'applyPlayerInput',
  'updateState',
  'serializeState',
  'onPlayerJoin',
  'onPlayerLeave',
] as const;

// ---------------------------------------------------------------------------
// V1 required methods (backward compat)
// ---------------------------------------------------------------------------

const V1_REQUIRED_METHODS = ['init', 'update', 'destroy'] as const;

// ---------------------------------------------------------------------------
// Source-level forbidden patterns
// ---------------------------------------------------------------------------

const FORBIDDEN_PATTERNS = [
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /\bfetch\s*\(\s*['"`]https?:\/\/(?!sloppy)/,
  /\bimportScripts\s*\(/,
];

// ---------------------------------------------------------------------------
// V2 source-level required patterns (method names that must appear)
// ---------------------------------------------------------------------------

const V2_SOURCE_PATTERNS: { name: string; pattern: RegExp }[] =
  V2_REQUIRED_METHODS.map((m) => ({
    name: m,
    pattern: new RegExp(`\\b${m}\\b`),
  }));

// ---------------------------------------------------------------------------
// Module validators
// ---------------------------------------------------------------------------

/**
 * Validate a loaded game module against the **v2** SloppyGameV2 contract.
 *
 * Checks:
 * - All required methods exist and are functions
 * - `metadata` is an object, `supportsMultiplayer` is a boolean
 * - If multiplayer, hooks object contains all required multiplayer methods
 */
export function validateGameModule(mod: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  for (const method of V2_REQUIRED_METHODS) {
    if (typeof mod[method] !== 'function') {
      errors.push(`Missing or invalid required method: ${method}`);
    }
  }

  if (typeof mod['supportsMultiplayer'] !== 'boolean') {
    errors.push('supportsMultiplayer must be a boolean property');
  }

  if (mod['metadata'] == null || typeof mod['metadata'] !== 'object') {
    errors.push('metadata must be an object');
  }

  if (mod['supportsMultiplayer'] === true) {
    const hooks = mod['multiplayerHooks'] as Record<string, unknown> | undefined;
    if (!hooks || typeof hooks !== 'object') {
      errors.push('Multiplayer game missing multiplayerHooks object');
    } else {
      for (const method of MULTIPLAYER_METHODS) {
        if (typeof hooks[method] !== 'function') {
          errors.push(`multiplayerHooks missing required hook: ${method}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a loaded module against the legacy **v1** SloppyGame contract.
 *
 * @deprecated Prefer `validateGameModule` for v2 games.
 */
export function validateGameModuleV1(mod: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  for (const method of V1_REQUIRED_METHODS) {
    if (typeof mod[method] !== 'function') {
      errors.push(`Missing or invalid required method: ${method}`);
    }
  }

  if (typeof mod['supportsMultiplayer'] !== 'boolean') {
    errors.push('supportsMultiplayer must be a boolean property');
  }

  if (mod['supportsMultiplayer'] === true) {
    for (const method of ['getInitialState', 'applyPlayerInput', 'updateState', 'serializeState']) {
      if (typeof mod[method] !== 'function') {
        errors.push(`Multiplayer game missing required hook: ${method}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Source validators
// ---------------------------------------------------------------------------

/**
 * Static analysis of raw game source code (JS string).
 *
 * - Rejects forbidden API usage (eval, dynamic Function, etc.)
 * - Verifies all v2 required method names appear in the source
 */
export function validateGameSource(source: string): ValidationResult {
  const errors: string[] = [];

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      errors.push(`Forbidden API usage detected: ${pattern.source}`);
    }
  }

  for (const { name, pattern } of V2_SOURCE_PATTERNS) {
    if (!pattern.test(source)) {
      errors.push(`Required method not found in source: ${name}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
