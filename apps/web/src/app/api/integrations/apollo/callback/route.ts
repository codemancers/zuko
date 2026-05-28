import { NextRequest, NextResponse } from 'next/server';

const FLASH_COOKIE = '_apollo_flash';
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const settingsUrl = new URL('/settings', request.url);
  settingsUrl.searchParams.set('tab', 'connections');

  if (error || !code || !state) {
    const response = NextResponse.redirect(settingsUrl);
    response.cookies.set(FLASH_COOKIE, `error:${error ?? 'missing_params'}`, {
      maxAge: 60,
      path: '/',
      httpOnly: false,
    });
    return response;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/integrations/apollo/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ code, state }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = body?.message ?? 'exchange_failed';
      const response = NextResponse.redirect(settingsUrl);
      response.cookies.set(FLASH_COOKIE, `error:${message}`, {
        maxAge: 60,
        path: '/',
        httpOnly: false,
      });
      return response;
    }

    const response = NextResponse.redirect(settingsUrl);
    response.cookies.set(FLASH_COOKIE, 'success', {
      maxAge: 60,
      path: '/',
      httpOnly: false,
    });
    return response;
  } catch {
    const response = NextResponse.redirect(settingsUrl);
    response.cookies.set(FLASH_COOKIE, 'error:connection_failed', {
      maxAge: 60,
      path: '/',
      httpOnly: false,
    });
    return response;
  }
}
