import { describe, expect, it } from 'vitest';
import { admin, member, owner } from '../index.js';

interface Authorizer {
  authorize(request: Record<string, string[]>): { success: boolean };
}

// Each role has its own exact statement type, so compare through a loose view.
const can = (role: unknown, permissions: Record<string, string[]>) =>
  (role as Authorizer).authorize(permissions).success;

describe('default roles', () => {
  it('lets owners and admins do everything with records and the schema', () => {
    for (const role of [owner, admin]) {
      expect(can(role, { record: ['read', 'create', 'update', 'delete', 'export'] })).toBe(true);
      expect(can(role, { object: ['manage'] })).toBe(true);
      expect(can(role, { team: ['create', 'update', 'delete'] })).toBe(true);
    }
  });

  it('only lets owners delete the organization', () => {
    expect(can(owner, { organization: ['delete'] })).toBe(true);
    expect(can(admin, { organization: ['delete'] })).toBe(false);
  });

  it('lets members read, create and update records', () => {
    expect(can(member, { record: ['read', 'create', 'update'] })).toBe(true);
  });

  it('stops members deleting, exporting or changing the schema', () => {
    expect(can(member, { record: ['delete'] })).toBe(false);
    expect(can(member, { record: ['export'] })).toBe(false);
    expect(can(member, { object: ['manage'] })).toBe(false);
  });

  it('stops members managing teams and people', () => {
    expect(can(member, { team: ['create'] })).toBe(false);
    expect(can(member, { member: ['create'] })).toBe(false);
  });
});
