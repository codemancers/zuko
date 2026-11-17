import { describe, expect, it } from 'vitest';
import { idField, MAX_ID, parseId } from './ids';

describe('parseId', () => {
  it('takes positive ids that fit a bigint, as digits or as a whole number', () => {
    expect(parseId('1')).toBe(1n);
    expect(parseId(42)).toBe(42n);
    expect(parseId('9223372036854775807')).toBe(MAX_ID);
  });

  it('refuses ids beyond the bigint range, whose digits would still pass a length check', () => {
    expect(parseId('9223372036854775808')).toBeUndefined();
    expect(parseId('9999999999999999999')).toBeUndefined();
    expect(parseId(2 ** 63)).toBeUndefined(); // not a safe integer either
  });

  it('refuses everything else', () => {
    for (const bad of ['0', '01', '-1', '', ' 1', '1 ', '1.5', '1e3', 0, -1, 1.5, Number.NaN, 2 ** 53, null, undefined, true, {}, []]) {
      expect(parseId(bad)).toBeUndefined();
    }
  });
});

describe('idField', () => {
  it('parses to a bigint and explains what was wrong', () => {
    expect(idField.safeParse('12').data).toBe(12n);
    const refused = idField.safeParse('9223372036854775808');
    expect(refused.success).toBe(false);
    expect(refused.error?.issues[0].message).toBe('must be a numeric id');
  });
});
