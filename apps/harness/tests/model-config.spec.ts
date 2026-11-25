import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('model routing', () => {
  it.each([undefined, 'false', 'invalid'])(
    'keeps the existing gateway default for %s',
    async (value) => {
      vi.stubEnv('EVE_USE_CODEX_SUBSCRIPTION', value);
      vi.resetModules();
      const { default: config } = await import('../agent/agent');
      expect(config.model).toBe('openai/gpt-5.6-terra');
    },
  );
  it('uses gpt-6.1-sol only when subscription routing is explicitly enabled', async () => {
    vi.stubEnv('EVE_USE_CODEX_SUBSCRIPTION', 'true');
    vi.resetModules();
    const { default: config } = await import('../agent/agent');
    expect(config.model).toMatchObject({ modelId: 'gpt-6.1-sol' });
  });
});
