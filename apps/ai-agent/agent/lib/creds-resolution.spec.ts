import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocked by resolved module identity — fly-sprite.ts imports the same file via
// "../lib/zuko-api.js", so this intercepts that import too.
vi.mock('./zuko-api.js', () => ({
  fetchClaudeOauth: vi.fn(),
}));

import { fetchClaudeOauth } from './zuko-api.js';
import { resolveClaudeCredsJson } from '../sandbox/fly-sprite.js';

const fetchClaudeOauthMock = vi.mocked(fetchClaudeOauth);

/**
 * Zuko silently falls back to null (→ env CLAUDE_CODE_OAUTH_TOKEN) when the
 * backend fetch fails — the opposite of gather's strict-throw policy. This lets
 * unlinked users fall back to a shared token without breaking the session.
 */
describe('resolveClaudeCredsJson', () => {
  beforeEach(() => {
    fetchClaudeOauthMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('principal present: fetches from the backend and wraps the blob', async () => {
    fetchClaudeOauthMock.mockResolvedValue({ accessToken: 'a' });
    const out = await resolveClaudeCredsJson({ userId: 1, orgId: 2 });
    expect(fetchClaudeOauthMock).toHaveBeenCalledWith({ userId: 1, orgId: 2 });
    expect(out).toBe(JSON.stringify({ claudeAiOauth: { accessToken: 'a' } }));
  });

  it('principal present + fetch rejects: returns null (silent fallback to env)', async () => {
    fetchClaudeOauthMock.mockRejectedValue(new Error('backend unreachable'));
    const out = await resolveClaudeCredsJson({ userId: 1, orgId: 2 });
    expect(out).toBeNull();
  });

  it('no principal: returns null without calling the backend', async () => {
    const out = await resolveClaudeCredsJson();
    expect(out).toBeNull();
    expect(fetchClaudeOauthMock).not.toHaveBeenCalled();
  });
});
