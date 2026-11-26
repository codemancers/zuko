import { describe, expect, it } from 'vitest';
import { can, canUploadFiles, defaultScopesFor, visibilitySql } from './permissions';
import type { RequestContext } from './context';

const ctx = (roles: string[]): RequestContext => ({
  userId: 7n,
  organizationId: 1n,
  roles,
  teamIds: [3n, 4n],
  requestId: 'r',
  actorType: 'USER',
});

describe('can', () => {
  it('follows the default roles', () => {
    expect(can(ctx(['member']), { record: ['read', 'update'] })).toBe(true);
    expect(can(ctx(['member']), { record: ['delete'] })).toBe(false);
    expect(can(ctx(['admin']), { object: ['manage'] })).toBe(true);
    expect(can(ctx(['member']), { object: ['manage'] })).toBe(false);
  });

  it('combines several roles and ignores unknown ones', () => {
    expect(can(ctx(['member', 'admin']), { record: ['delete'] })).toBe(true);
    expect(can(ctx(['mystery']), { record: ['read'] })).toBe(false);
    expect(can(ctx([]), { record: ['read'] })).toBe(false);
  });
});

describe('canUploadFiles', () => {
  it('is for roles that can change records or comment', () => {
    for (const role of ['owner', 'admin', 'member']) expect(canUploadFiles(ctx([role]))).toBe(true);
  });

  it('is not for unknown roles or none, which can do nothing', () => {
    expect(canUploadFiles(ctx(['viewer']))).toBe(false);
    expect(canUploadFiles(ctx([]))).toBe(false);
    expect(canUploadFiles(ctx(['viewer', 'member']))).toBe(true);
  });
});

describe('defaultScopesFor', () => {
  it('gives owners and admins everything, members their own and their reports', () => {
    expect(defaultScopesFor('owner')).toEqual({ read: 'ALL', write: 'ALL' });
    expect(defaultScopesFor('member')).toEqual({ read: 'OWN_AND_REPORTS', write: 'OWN' });
    expect(defaultScopesFor('unknown')).toEqual({ read: 'OWN', write: 'OWN' });
  });
});

describe('visibilitySql', () => {
  const text = (scopes: Parameters<typeof visibilitySql>[1], mode: 'read' | 'write') =>
    visibilitySql(ctx(['member']), scopes, mode).sql;

  it('is unconditional for ALL', () => {
    expect(text(new Set(['ALL']), 'read')).toBe('TRUE');
  });

  it('limits OWN to the user, with shares as the only way in', () => {
    const sql = text(new Set(['OWN']), 'read');
    expect(sql).toContain('"owner_id" =');
    expect(sql).not.toContain('member_hierarchy');
    expect(sql).toContain('record_share');
  });

  it('adds reports and teams for the wider scopes', () => {
    expect(text(new Set(['OWN_AND_REPORTS']), 'read')).toContain('member_hierarchy');
    expect(text(new Set(['TEAM']), 'read')).toContain('"team_id" = ANY');
  });

  it('only counts WRITE shares when writing', () => {
    expect(text(new Set(['OWN']), 'read')).not.toContain("'WRITE'");
    expect(text(new Set(['OWN']), 'write')).toContain("'WRITE'");
  });
});
