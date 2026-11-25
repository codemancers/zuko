import { NextRequest } from 'next/server';
import { proxy } from './proxy';

beforeEach(() => {
  vi.stubEnv('BACKEND_URL', 'http://localhost:3000');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ session: { id: 'session' }, user: { id: '7' } })),
  );
});
const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:4200${path}`, {
    headers: cookie ? { cookie } : {},
  });

it.each([
  '/login',
  '/signup',
  '/consent?sig=signed',
  '/accept-invitation/invitation',
  '/favicon.ico',
  '/icon.svg',
  '/eve/v1/session',
])('explicitly allows %s', async (path) => {
  expect((await proxy(request(path))).headers.get('x-middleware-next')).toBe('1');
  expect(fetch).not.toHaveBeenCalled();
});

it.each(['/organizations/setup', '/some-new-page?q=kept', '/reports.json', '/eve/v1-admin'])(
  'protects %s by default and preserves the return path',
  async (path) => {
    const response = await proxy(request(path));
    const target = new URL(response.headers.get('location')!);
    expect(target.pathname).toBe('/login');
    expect(target.searchParams.get('next')).toBe(path);
  },
);

it('returns 401 for unauthenticated APIs instead of redirecting them to HTML', async () => {
  const response = await proxy(request('/api/hello'));
  expect(response.status).toBe(401);
});

it('does not trust a forged or expired session cookie', async () => {
  vi.mocked(fetch).mockImplementation(async () => Response.json(null));
  const response = await proxy(request('/organizations/setup', 'better-auth.session_token=forged'));
  expect(response.status).toBe(307);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('accepts a verified session and forwards refresh cookies', async () => {
  vi.mocked(fetch).mockImplementation(async () =>
    Response.json(
      { session: { id: 'session' }, user: { id: '7' } },
      { headers: { 'Set-Cookie': 'better-auth.session_token=refreshed; Path=/; HttpOnly' } },
    ),
  );
  const response = await proxy(request('/dashboard', 'better-auth.session_token=valid'));
  expect(response.headers.get('x-middleware-next')).toBe('1');
  expect(response.headers.get('set-cookie')).toContain('refreshed');
});

it('fails closed when session validation is unavailable', async () => {
  vi.mocked(fetch).mockRejectedValue(new Error('Unavailable'));
  const response = await proxy(request('/dashboard', 'better-auth.session_token=valid'));
  expect(response.status).toBe(503);
});

it('routes public MCP discovery to the harness without checking a web session', async () => {
  const response = await proxy(request('/.well-known/oauth-protected-resource/eve/v1/mcp'));
  expect(response.headers.get('x-middleware-rewrite')).toBe(
    'http://localhost:4200/eve/v1/mcp/metadata',
  );
  expect(fetch).not.toHaveBeenCalled();
});
