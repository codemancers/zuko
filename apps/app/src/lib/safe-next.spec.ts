import { safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  it('allows same-site paths, including query strings', () => {
    expect(safeNextPath('/accept-invitation/abc')).toBe('/accept-invitation/abc');
    expect(safeNextPath('/org/settings/members?sort=name')).toBe('/org/settings/members?sort=name');
  });

  it.each([
    ['absolute URL', 'https://evil.com'],
    ['protocol-relative URL', '//evil.com'],
    ['backslash variant browsers treat as //', '/\\evil.com'],
    ['relative path', 'dashboard'],
    ['javascript URL', 'javascript:alert(1)'],
  ])('falls back for a %s', (_label, value) => {
    expect(safeNextPath(value)).toBe('/dashboard');
  });

  it('falls back when missing', () => {
    expect(safeNextPath(null)).toBe('/dashboard');
    expect(safeNextPath(undefined)).toBe('/dashboard');
    expect(safeNextPath('')).toBe('/dashboard');
  });

  it('uses a custom fallback', () => {
    expect(safeNextPath('//evil.com', '/home')).toBe('/home');
  });
});
