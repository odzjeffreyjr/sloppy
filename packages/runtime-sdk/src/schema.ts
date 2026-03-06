/**
 * JSON Schema for GameConfig (`config.json`).
 * Used to validate the config file bundled with every generated game.
 *
 * Backward-compatible: v1 configs without `engine`, `genre`, `controls`,
 * `resolution`, or `estimatedPlayTime` still validate (those fields fall back
 * to sensible defaults at load time).
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
    engine: {
      type: 'string',
      enum: ['phaser3', 'threejs', 'canvas2d'],
      default: 'canvas2d',
      description: 'Rendering engine. Defaults to canvas2d for v1 games.',
    },
    genre: {
      type: 'string',
      enum: [
        '2d-platformer',
        '2d-topdown',
        '2d-puzzle',
        '2d-arcade',
        '2d-shooter',
        '2d-tower-defense',
        '2d-endless-runner',
        '2d-rhythm',
        '2d-cards',
        '2d-idle',
        '2d-custom',
        '3d-firstperson',
        '3d-thirdperson',
        '3d-racing',
        '3d-puzzle',
        '3d-flight',
        '3d-platformer',
        '3d-custom',
      ],
    },
    supportsMultiplayer: {
      type: 'boolean',
    },
    maxPlayers: {
      type: 'integer',
      minimum: 2,
      maximum: 16,
    },
    controls: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'action'],
        properties: {
          key: { type: 'string' },
          action: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    resolution: {
      type: 'object',
      required: ['width', 'height', 'scaleMode'],
      properties: {
        width: { type: 'integer', minimum: 1 },
        height: { type: 'integer', minimum: 1 },
        scaleMode: {
          type: 'string',
          enum: ['fit', 'fill', 'stretch'],
        },
      },
      additionalProperties: false,
    },
    assets: {
      type: 'array',
      items: { type: 'string' },
    },
    audio: {
      type: 'array',
      items: { type: 'string' },
    },
    estimatedPlayTime: {
      type: 'string',
      description: 'Human-readable estimate, e.g. "2-5 min".',
    },
  },
  additionalProperties: false,
} as const;
