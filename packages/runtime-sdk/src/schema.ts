/**
 * JSON Schema for GameConfig (`config.json`).
 * Used to validate the config file bundled with every generated game.
 */
export const gameConfigSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'GameConfig',
  type: 'object',
  required: ['title', 'version', 'supportsMultiplayer', 'assets'],
  properties: {
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 120,
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$',
    },
    supportsMultiplayer: {
      type: 'boolean',
    },
    maxPlayers: {
      type: 'integer',
      minimum: 2,
      maximum: 16,
    },
    assets: {
      type: 'array',
      items: { type: 'string' },
    },
    audio: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  additionalProperties: false,
} as const;
