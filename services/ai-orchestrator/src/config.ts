export const config = {
  port: parseInt(process.env.PORT || '3004', 10),

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  llm: {
    provider: (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'anthropic' | 'grok',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    },
    grok: {
      apiKey: process.env.GROK_API_KEY || '',
      model: process.env.GROK_MODEL || 'grok-3',
    },
  },

  gameBuilderUrl: process.env.GAME_BUILDER_URL || 'http://localhost:3003',

  generation: {
    timeoutMs: parseInt(process.env.GENERATION_TIMEOUT_MS || '480000', 10),
    maxRetries: 2,
    maxDebugIterations: parseInt(process.env.MAX_DEBUG_ITERATIONS || '5', 10),
    enablePolish: process.env.ENABLE_POLISH !== 'false',
    sessionTtlSeconds: 3600,
    maxTokens: {
      concept: parseInt(process.env.MAX_TOKENS_CONCEPT || '2000', 10),
      planning: parseInt(process.env.MAX_TOKENS_PLANNING || '3000', 10),
      code: parseInt(process.env.MAX_TOKENS_CODE || '12000', 10),
      fix: parseInt(process.env.MAX_TOKENS_FIX || '12000', 10),
      polish: parseInt(process.env.MAX_TOKENS_POLISH || '12000', 10),
      assets: parseInt(process.env.MAX_TOKENS_ASSETS || '2000', 10),
      audio: parseInt(process.env.MAX_TOKENS_AUDIO || '12000', 10),
      multiplayer: parseInt(process.env.MAX_TOKENS_MULTIPLAYER || '4000', 10),
    },
  },
} as const;
