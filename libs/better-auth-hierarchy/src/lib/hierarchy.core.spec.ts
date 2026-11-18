import { describe, expect, it } from 'vitest';
import { computeClosure, effectiveManagers, wouldCreateCycle, type ReportingRow } from './hierarchy.core.js';

const members = (...ids: string[]) => new Set(ids);
const reports = (...pairs: [string, string | null][]): ReportingRow[] =>
  pairs.map(([userId, managerId]) => ({ userId, managerId }));
const pairs = (rows: ReturnType<typeof computeClosure>) =>
  rows.map((r) => `${r.ancestorId}>${r.descendantId}@${r.depth}`).sort();

describe('computeClosure', () => {
  it('lists every ancestor of every member, with depth', () => {
    // ceo <- vp <- lead <- ic
    const rows = computeClosure(
      members('ceo', 'vp', 'lead', 'ic'),
      reports(['vp', 'ceo'], ['lead', 'vp'], ['ic', 'lead']),
    );
    expect(pairs(rows)).toEqual(['ceo>ic@3', 'ceo>lead@2', 'ceo>vp@1', 'lead>ic@1', 'vp>ic@2', 'vp>lead@1']);
  });

  it('gives people with no manager no ancestors', () => {
    expect(computeClosure(members('a', 'b'), reports(['a', null]))).toEqual([]);
  });

  it('moves reports up when their manager is no longer a member', () => {
    // ic reports to lead, lead reports to vp, but lead has left.
    const rows = computeClosure(members('vp', 'ic'), reports(['lead', 'vp'], ['ic', 'lead']));
    expect(pairs(rows)).toEqual(['vp>ic@1']);
  });

  it('terminates on a corrupted loop', () => {
    const rows = computeClosure(members('a', 'b'), reports(['a', 'b'], ['b', 'a']));
    expect(rows.length).toBeLessThanOrEqual(2);
  });
});

describe('effectiveManagers', () => {
  it('returns null when the whole chain has left', () => {
    const result = effectiveManagers(members('ic'), reports(['ic', 'gone'], ['gone', 'alsoGone']));
    expect(result.get('ic')).toBeNull();
  });
});

describe('wouldCreateCycle', () => {
  const chain = reports(['vp', 'ceo'], ['lead', 'vp'], ['ic', 'lead']);

  it('rejects a self-manager', () => {
    expect(wouldCreateCycle(chain, 'ic', 'ic')).toBe(true);
  });

  it('rejects making a descendant the manager', () => {
    expect(wouldCreateCycle(chain, 'ceo', 'ic')).toBe(true);
    expect(wouldCreateCycle(chain, 'vp', 'ic')).toBe(true);
  });

  it('allows a valid reassignment', () => {
    expect(wouldCreateCycle(chain, 'ic', 'ceo')).toBe(false);
    expect(wouldCreateCycle(chain, 'lead', 'ceo')).toBe(false);
  });
});
