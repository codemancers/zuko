import { defineAgent } from 'eve';
import { chatgpt } from 'eve/models/openai';

export default defineAgent({
  defaultTools: false,
  model:
    process.env.EVE_USE_CODEX_SUBSCRIPTION === 'true'
      ? chatgpt('gpt-6.1-sol')
      : 'openai/gpt-5.6-terra',
  reasoning: 'medium',
  limits: {
    sessionUsage: ({ window }) =>
      window.inputTokens - window.cacheReadTokens >= 250_000 ||
      window.outputTokens >= 30_000 ||
      (window.costUsd ?? 0) >= 5,
    sessionTimeoutMs: 14 * 24 * 60 * 60 * 1_000,
  },
});
