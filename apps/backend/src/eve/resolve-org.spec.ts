import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { resolveOrgId } from './resolve-org';

describe('resolveOrgId', () => {
  it('parses valid x-org-id header', () => {
    const req = { headers: { 'x-org-id': '9870' } } as never;
    expect(resolveOrgId(req)).toBe(9870);
  });

  it('throws BadRequestException when x-org-id is missing', () => {
    const req = { headers: {} } as never;
    expect(() => resolveOrgId(req)).toThrow(BadRequestException);
  });

  it('throws BadRequestException when x-org-id is non-numeric', () => {
    const req = { headers: { 'x-org-id': 'abc' } } as never;
    expect(() => resolveOrgId(req)).toThrow(BadRequestException);
  });

  it('returns first element when x-org-id is array-valued', () => {
    const req = { headers: { 'x-org-id': ['9870', '1'] } } as never;
    expect(resolveOrgId(req)).toBe(9870);
  });
});
