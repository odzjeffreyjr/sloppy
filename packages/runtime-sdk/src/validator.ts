/** Result returned by the runtime validator. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const REQUIRED_METHODS = ['init', 'update', 'destroy'] as const;
const MULTIPLAYER_METHODS = [
  'getInitialState',
  'applyPlayerInput',
  'updateState',
  'serializeState',
] as const;

const FORBIDDEN_PATTERNS = [
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /\bFunction\s*\(/,
  /\bfetch\s*\(\s*['"`]https?:\/\/(?!sloppy)/,
  /\bimportScripts\s*\(/,
];

/**
 * Validate a game module (object already loaded) against the SloppyGame contract.
 *
 * Checks:
 * - All required methods exist and are functions
 * - `supportsMultiplayer` is a boolean
 * - If multiplayer is enabled, multiplayer hooks exist and are functions
 */
export function validateGameModule(mod: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  for (const method of REQUIRED_METHODS) {
    if (typeof mod[method] !== 'function') {
      errors.push(`Missing or invalid required method: ${method}`);
    }
  }

  if (typeof mod['supportsMultiplayer'] !== 'boolean') {
    errors.push('supportsMultiplayer must be a boolean property');
  }

  if (mod['supportsMultiplayer'] === true) {
    for (const method of MULTIPLAYER_METHODS) {
      if (typeof mod[method] !== 'function') {
        errors.push(`Multiplayer game missing required hook: ${method}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate raw game source code (JS string) for forbidden API usage.
 *
 * This is a static analysis pass that runs BEFORE the code is loaded.
 * It does not execute the code.
 */
export function validateGameSource(source: string): ValidationResult {
  const errors: string[] = [];

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      errors.push(`Forbidden API usage detected: ${pattern.source}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
