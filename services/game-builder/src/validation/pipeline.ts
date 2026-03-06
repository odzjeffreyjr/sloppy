import Ajv from 'ajv';
import { validateGameSource } from '@sloppy/runtime-sdk';
import { gameConfigSchema } from '@sloppy/runtime-sdk';
import type { GameConfig } from '@sloppy/runtime-sdk';
import { config } from '../config.js';

const ajv = new Ajv({ allErrors: true });
const validateConfig = ajv.compile(gameConfigSchema);

export interface BundleInput {
  'index.html': string;
  'game.js': string;
  'config.json': string;
  [path: string]: string;
}

export interface ValidationError {
  check: string;
  message: string;
}

export interface ValidationOutput {
  valid: boolean;
  errors: ValidationError[];
  config?: GameConfig;
  /** True when config.json includes an `engine` field (v2 game). */
  isV2: boolean;
}

const REQUIRED_FILES = ['index.html', 'game.js', 'config.json'] as const;

const REQUIRED_METHODS_V1 = ['init', 'update', 'destroy'] as const;

const REQUIRED_METHODS_V2 = [
  'init', 'destroy', 'start', 'pause', 'resume', 'restart',
  'renderIntroScreen', 'renderPauseScreen', 'renderGameOverScreen',
  'getState', 'getScore',
] as const;

const ADDITIONAL_FORBIDDEN = [
  /\bdocument\.cookie\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
];

function methodExistsInSource(source: string, method: string): boolean {
  const patterns = [
    new RegExp(`\\b${method}\\s*\\(`),
    new RegExp(`\\b${method}\\s*:\\s*(async\\s+)?function\\b`),
    new RegExp(`\\b${method}\\s*:\\s*(async\\s+)?\\(`),
    new RegExp(`\\b${method}\\s*=\\s*(async\\s+)?function\\b`),
    new RegExp(`\\b${method}\\s*=\\s*(async\\s+)?\\(`),
  ];
  return patterns.some((p) => p.test(source));
}

export function validateBundle(files: Record<string, string>): ValidationOutput {
  const errors: ValidationError[] = [];

  // 1. Required files
  for (const file of REQUIRED_FILES) {
    if (!files[file]) {
      errors.push({ check: 'required_files', message: `Missing required file: ${file}` });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, isV2: false };
  }

  // 2. Pre-parse config to detect v1 vs v2
  let parsedConfig: GameConfig | undefined;
  let isV2 = false;
  try {
    parsedConfig = JSON.parse(files['config.json']) as GameConfig;
    isV2 = parsedConfig.engine !== undefined;
  } catch {
    // Full config validation happens below; just default to v1
  }

  // 3. Method detection using the appropriate version list
  const gameJs = files['game.js'];
  const requiredMethods = isV2 ? REQUIRED_METHODS_V2 : REQUIRED_METHODS_V1;

  for (const method of requiredMethods) {
    if (!methodExistsInSource(gameJs, method)) {
      errors.push({
        check: 'interface_methods',
        message: `game.js does not appear to implement required method: ${method}`,
      });
    }
  }

  // 4. Forbidden patterns (runtime-sdk checks + additional)
  // validateGameSource also checks v2 method presence; filter those for v1 games
  const sourceResult = validateGameSource(gameJs);
  if (!sourceResult.valid) {
    for (const msg of sourceResult.errors) {
      if (!isV2 && msg.startsWith('Required method not found')) continue;
      errors.push({ check: 'forbidden_patterns', message: msg });
    }
  }

  for (const pattern of ADDITIONAL_FORBIDDEN) {
    if (pattern.test(gameJs)) {
      errors.push({
        check: 'forbidden_patterns',
        message: `Forbidden API usage detected: ${pattern.source}`,
      });
    }
  }

  // 5. Total bundle size
  let totalSize = 0;
  for (const content of Object.values(files)) {
    totalSize += Buffer.byteLength(content, 'utf8');
  }

  if (totalSize > config.validation.maxBundleSizeBytes) {
    const maxMb = (config.validation.maxBundleSizeBytes / (1024 * 1024)).toFixed(1);
    const actualMb = (totalSize / (1024 * 1024)).toFixed(2);
    errors.push({
      check: 'bundle_size',
      message: `Bundle size ${actualMb}MB exceeds maximum ${maxMb}MB`,
    });
  }

  // 6. config.json schema validation
  if (!parsedConfig) {
    try {
      parsedConfig = JSON.parse(files['config.json']) as GameConfig;
    } catch (e) {
      errors.push({
        check: 'config_schema',
        message: `config.json is not valid JSON: ${(e as Error).message}`,
      });
    }
  }

  if (parsedConfig) {
    const configValid = validateConfig(parsedConfig);
    if (!configValid && validateConfig.errors) {
      for (const err of validateConfig.errors) {
        errors.push({
          check: 'config_schema',
          message: `config.json validation: ${err.instancePath || '/'} ${err.message}`,
        });
      }
    }
  }

  // 7. JS syntax check (basic — try to parse)
  try {
    new Function(gameJs);
  } catch (e) {
    errors.push({
      check: 'js_syntax',
      message: `game.js has syntax errors: ${(e as Error).message}`,
    });
  }

  // 8. Multiplayer hook validation (v2 only)
  if (isV2 && parsedConfig?.supportsMultiplayer) {
    const requiredHooks = [
      'getInitialState',
      'applyPlayerInput',
      'updateState',
      'serializeState',
      'onPlayerJoin',
      'onPlayerLeave',
    ] as const;

    const hasMultiplayerHooks = gameJs.includes('multiplayerHooks');
    if (!hasMultiplayerHooks) {
      errors.push({
        check: 'multiplayer_hooks',
        message: 'supportsMultiplayer is true but multiplayerHooks object is missing',
      });
    } else {
      for (const hook of requiredHooks) {
        if (!methodExistsInSource(gameJs, hook)) {
          errors.push({
            check: 'multiplayer_hooks',
            message: `multiplayerHooks missing required method: ${hook}`,
          });
        }
      }
    }

    if (!gameJs.includes('supportsMultiplayer')) {
      errors.push({
        check: 'multiplayer_hooks',
        message: 'supportsMultiplayer property not found in game source',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    config: parsedConfig,
    isV2,
  };
}
