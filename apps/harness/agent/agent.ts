import { defineAgent } from 'eve';

export default defineAgent({
  model: 'openai/gpt-5.6-terra',
  reasoning: 'medium',
  limits: {
    sessionUsage: ({ window }) =>
      window.inputTokens - window.cacheReadTokens >= 250_000 ||
      window.outputTokens >= 30_000 ||
      (window.costUsd ?? 0) >= 5,
    sessionTimeoutMs: 14 * 24 * 60 * 60 * 1_000,
  },
});
