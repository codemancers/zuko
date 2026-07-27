import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { EveCredentialsController } from './eve-credentials.controller';

describe('EveCredentialsController', () => {
  it("returns the principal user's Claude oauth blob", async () => {
    const blob = {
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: 1,
      scopes: [],
    };
    const accounts = { getValidClaudeOauth: vi.fn().mockResolvedValue(blob) };
    const ctrl = new EveCredentialsController(accounts as never);
    const req = { evePrincipal: { userId: 42, orgId: 1 } } as never;
    await expect(ctrl.claudeOauth(req)).resolves.toEqual(blob);
    expect(accounts.getValidClaudeOauth).toHaveBeenCalledWith(42);
  });

  it('surfaces a Claude-not-connected error as a 400 BadRequestException, not a 500', async () => {
    const accounts = {
      getValidClaudeOauth: vi
        .fn()
        .mockRejectedValue(
          new Error('Claude not connected. Add it under Settings.'),
        ),
    };
    const ctrl = new EveCredentialsController(accounts as never);
    const req = { evePrincipal: { userId: 42, orgId: 1 } } as never;

    await expect(ctrl.claudeOauth(req)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(ctrl.claudeOauth(req)).rejects.toMatchObject({
      message: 'Claude not connected. Add it under Settings.',
    });
  });

  it('re-throws a transient upstream error unchanged, not as a 400', async () => {
    const transientErr = new Error('Anthropic API unreachable');
    const accounts = {
      getValidClaudeOauth: vi.fn().mockRejectedValue(transientErr),
    };
    const ctrl = new EveCredentialsController(accounts as never);
    const req = { evePrincipal: { userId: 42, orgId: 1 } } as never;

    await expect(ctrl.claudeOauth(req)).rejects.not.toBeInstanceOf(
      BadRequestException,
    );
    await expect(ctrl.claudeOauth(req)).rejects.toBe(transientErr);
  });
});
