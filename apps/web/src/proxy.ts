import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Lightweight middleware for Next.js 16
// For cross-origin auth (frontend on zuko-webv.fly.dev, backend on zuko-bknd.fly.dev),
// we can't check httpOnly cookies in middleware, so authentication validation
// happens client-side in ApplicationLayout via authClient.getSession()

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('[PROXY] Request to:', pathname);

  // All routes are allowed - authentication is handled client-side
  // The ApplicationLayout component will check the session and redirect if needed
  return NextResponse.next();
}

export const config = {
  // Protect all routes except public ones
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
