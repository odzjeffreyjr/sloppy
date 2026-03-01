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
}

const REQUIRED_FILES = ['index.html', 'game.js', 'config.json'] as const;

const ADDITIONAL_FORBIDDEN = [
  /\bdocument\.cookie\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
];

export function validateBundle(files: Record<string, string>): ValidationOutput {
  const errors: ValidationError[] = [];

  // 1. Required files
  for (const file of REQUIRED_FILES) {
    if (!files[file]) {
      errors.push({ check: 'required_files', message: `Missing required file: ${file}` });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 2. game.js implements SloppyGame interface methods (static check)
  const gameJs = files['game.js'];
  const requiredMethods = ['init', 'update', 'destroy'];
  for (const method of requiredMethods) {
    const methodPattern = new RegExp(`\\b${method}\\s*\\(`);
    if (!methodPattern.test(gameJs)) {
      errors.push({
        check: 'interface_methods',
        message: `game.js does not appear to implement required method: ${method}`,
      });
    }
  }

  // 3. Forbidden patterns (runtime-sdk checks + additional)
  const sourceResult = validateGameSource(gameJs);
  if (!sourceResult.valid) {
    for (const msg of sourceResult.errors) {
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

  // 4. Total bundle size
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

  // 5. config.json schema validation
  let parsedConfig: GameConfig | undefined;
  try {
    parsedConfig = JSON.parse(files['config.json']) as GameConfig;
    const configValid = validateConfig(parsedConfig);
    if (!configValid && validateConfig.errors) {
      for (const err of validateConfig.errors) {
        errors.push({
          check: 'config_schema',
          message: `config.json validation: ${err.instancePath || '/'} ${err.message}`,
        });
      }
    }
  } catch (e) {
    errors.push({
      check: 'config_schema',
      message: `config.json is not valid JSON: ${(e as Error).message}`,
    });
  }

  // 6. JS syntax check (basic — try to parse)
  try {
    new Function(gameJs);
  } catch (e) {
    errors.push({
      check: 'js_syntax',
      message: `game.js has syntax errors: ${(e as Error).message}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    config: parsedConfig,
  };
}
