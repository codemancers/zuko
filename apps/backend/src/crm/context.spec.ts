import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { CrmContextGuard, type CrmContextService } from './context';
import type { HarnessGrantsService } from '../libs/eve/harness-grants.service';

function setup(request: object, sourceType = 'consent') {
  const build = vi.fn<(input: unknown) => Promise<unknown>>(async (input) => input);
  const delegation = vi.fn<
    () => Promise<{ userId: bigint; organizationId: bigint; sourceType: string }>
  >(async () => ({ userId: 1n, organizationId: 2n, sourceType }));
  const handler = () => {};
  class Controller {}
  Reflect.defineMetadata('harnessScope', 'records:read', Controller);
  const execution = {
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const guard = new CrmContextGuard(
    { build } as unknown as CrmContextService,
    { delegation } as unknown as HarnessGrantsService,
    new Reflector(),
  );
  return { guard, execution, build, delegation, handler };
}

describe('CRM authentication context', () => {
  it.each([
    ['session', 'AGENT'],
    ['consent', 'MCP'],
  ])('supports class metadata and attributes %s calls to %s', async (source, actorType) => {
    const test = setup({ headers: { authorization: 'Bearer valid' } }, source);
    expect(await test.guard.canActivate(test.execution)).toBe(true);
    expect(test.delegation).toHaveBeenCalledWith('valid', 'records:read');
    expect(test.build).toHaveBeenCalledWith({ userId: 1n, organizationId: 2n, actorType });
  });
  it('uses a populated browser session when there is no Authorization header', async () => {
    const test = setup({
      headers: {},
      session: { user: { id: '1' }, session: { activeOrganizationId: '2' } },
    });
    expect(await test.guard.canActivate(test.execution)).toBe(true);
    expect(test.build).toHaveBeenCalledWith(expect.objectContaining({ actorType: 'USER' }));
    expect(test.delegation).not.toHaveBeenCalled();
  });
  it('does not fall back to cookies when an explicit bearer credential is invalid', async () => {
    const test = setup({
      headers: { authorization: 'Basic invalid' },
      session: { user: { id: '1' } },
    });
    await expect(test.guard.canActivate(test.execution)).rejects.toThrow(/bearer/);
    expect(test.build).not.toHaveBeenCalled();
  });
  it('lets handler scope metadata override the class', async () => {
    const test = setup({ headers: { authorization: 'Bearer valid' } });
    Reflect.defineMetadata('harnessScope', 'records:write', test.handler);
    await test.guard.canActivate(test.execution);
    expect(test.delegation).toHaveBeenCalledWith('valid', 'records:write');
  });
});
