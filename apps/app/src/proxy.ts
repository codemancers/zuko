import { getSessionCookie } from 'better-auth/cookies';
import { NextRequest, NextResponse } from 'next/server';

// Consent and invitation landings preserve their signed requests through login.
const publicPages = new Set(['/login', '/signup', '/consent']);
const publicAssets = new Set(['/favicon.ico', '/icon.svg']);

/** New application routes require a valid session unless explicitly allowlisted here. */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (
    publicPages.has(pathname) ||
    publicAssets.has(pathname) ||
    /^\/accept-invitation\/[^/]+$/.test(pathname) ||
    // Eve authenticates these protocol requests with its own bearer tokens/callbacks.
    pathname.startsWith('/eve/v1/')
  ) return NextResponse.next();

  let auth: Response | undefined;
  let authenticated = false;
  if (getSessionCookie(request)) {
    try {
      const backend = process.env.BACKEND_URL || 'http://localhost:3000';
      auth = await fetch(new URL('/auth/get-session', backend), {
        headers: { cookie: request.headers.get('cookie') ?? '' },
        cache: 'no-store',
        signal: request.signal,
      });
      if (!auth.ok) throw new Error('Session validation failed');
      const data = await auth.json();
      authenticated = !!data?.session?.id && !!data?.user?.id;
    } catch {
      return new NextResponse('Authentication service is unavailable. Please try again.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  }

  const login = new URL('/login', request.url);
  login.searchParams.set('next', pathname + search);
  const response = authenticated
    ? NextResponse.next()
    : pathname === '/api' || pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      : NextResponse.redirect(login);
  // Preserve Better Auth's session refresh/expiry cookies from the server-side check.
  for (const cookie of auth?.headers.getSetCookie() ?? []) {
    response.headers.append('Set-Cookie', cookie);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|_next/webpack-hmr).*)'],
};
