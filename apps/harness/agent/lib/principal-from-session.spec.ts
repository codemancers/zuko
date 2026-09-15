import { describe, it, expect } from 'vitest';
import { principalFromSession } from '../tools/ensure-session-sprite.js';

describe('principalFromSession', () => {
  it('valid current: returns {userId, orgId}', () => {
    const p = principalFromSession({
      current: { principalId: '9', attributes: { orgId: '4' } },
    });
    expect(p).toEqual({ userId: 9, orgId: 4 });
  });

  it('principalId non-numeric: returns undefined', () => {
    const p = principalFromSession({
      current: { principalId: 'not-a-number', attributes: { orgId: '4' } },
    });
    expect(p).toBeUndefined();
  });

  it('orgId as a one-element array: uses the first element', () => {
    const p = principalFromSession({
      current: { principalId: '9', attributes: { orgId: ['4'] } },
    });
    expect(p).toEqual({ userId: 9, orgId: 4 });
  });

  it('current absent: returns undefined', () => {
    expect(principalFromSession({})).toBeUndefined();
  });

  it('current null: returns undefined', () => {
    expect(principalFromSession({ current: null })).toBeUndefined();
  });

  it('orgId non-numeric: returns undefined', () => {
    const p = principalFromSession({
      current: { principalId: '9', attributes: { orgId: 'not-a-number' } },
    });
    expect(p).toBeUndefined();
  });
});
