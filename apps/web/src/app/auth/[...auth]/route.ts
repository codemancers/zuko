import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  isTopLevelNavigation,
  redirectTargetFromBody,
  rewriteCookieForProxy,
} from '@/lib/auth-proxy';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Proxy all /auth/* requests to the backend /auth endpoint
// This ensures cookies are set on the frontend domain, avoiding third-party cookie issues
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ auth: string[] }> },
) {
  return proxyToBackend(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ auth: string[] }> },
) {
  return proxyToBackend(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ auth: string[] }> },
) {
  return proxyToBackend(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ auth: string[] }> },
) {
  return proxyToBackend(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ auth: string[] }> },
) {
  return proxyToBackend(request, context);
}

/** Copy the backend's cookies across, re-scoped onto this origin. */
function applyCookies(from: Response, to: NextResponse, label: string) {
  from.headers.getSetCookie().forEach((cookie) => {
    const rewrittenCookie = rewriteCookieForProxy(cookie);

    console.log(`[AUTH PROXY] Rewriting cookie on ${label}:`, {
      original: cookie,
      rewritten: rewrittenCookie,
    });
    to.headers.append('Set-Cookie', rewrittenCookie);
  });
}

async function proxyToBackend(
  request: NextRequest,
  context: { params: Promise<{ auth: string[] }> },
) {
  const { auth } = await context.params;
  const authPath = auth.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const queryString = searchParams ? `?${searchParams}` : '';

  const backendUrl = `${BACKEND_URL}/auth/${authPath}${queryString}`;

  console.log('[AUTH PROXY]', request.method, authPath, '→', backendUrl);

  try {
    // Build headers to forward - include Origin for CORS and security headers
    const forwardHeaders: Record<string, string> = {
      'Content-Type': request.headers.get('content-type') || 'application/json',
    };

    // Forward important headers for auth and security
    const headersToForward = [
      'cookie',
      'origin', // Critical for CORS
      'referer',
      'user-agent',
      'accept',
      'accept-language',
    ];

    headersToForward.forEach((header) => {
      const value = request.headers.get(header);
      if (value) {
        forwardHeaders[header] = value;
      }
    });

    // Forward the real browser IP. This server-side proxy is the only client the
    // backend sees, so without an explicit client IP better-auth (>=1.6) buckets
    // every user into one shared rate-limit key and the /sign-in* limit
    // (3 req / 10s) trips on a single login → 429. Fly sets `fly-client-ip` to
    // the browser IP on the request into the frontend; we pass it as
    // `x-real-ip` (Fly rewrites fly-client-ip on the internal proxy→backend hop).
    const clientIp =
      request.headers.get('fly-client-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (clientIp) {
      forwardHeaders['x-real-ip'] = clientIp;
    }

    console.log('[AUTH PROXY] Headers:', Object.keys(forwardHeaders));

    // Forward the request to the backend
    const response = await fetch(backendUrl, {
      method: request.method,
      headers: forwardHeaders,
      body:
        request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.text()
          : undefined,
      redirect: 'manual', // Don't auto-follow redirects
    });

    console.log('[AUTH PROXY] Response:', response.status, response.statusText);

    // Handle redirects - but also set cookies!
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      console.log('[AUTH PROXY] Redirect to:', location);

      if (location) {
        // Convert relative URLs to absolute URLs (Next.js requires absolute URLs)
        let absoluteLocation = location;
        if (location.startsWith('/')) {
          // Get the actual host from headers (not nextUrl.origin which can be 0.0.0.0:3000)
          const host =
            request.headers.get('x-forwarded-host') ||
            request.headers.get('host') ||
            request.nextUrl.host;
          const protocol =
            request.headers.get('x-forwarded-proto') ||
            request.nextUrl.protocol.replace(':', '') ||
            'https';
          absoluteLocation = `${protocol}://${host}${location}`;
        }

        const redirectResponse = NextResponse.redirect(
          absoluteLocation,
          response.status,
        );

        applyCookies(response, redirectResponse, 'redirect');

        return redirectResponse;
      }
    }

    // better-auth's oauth-provider content-negotiates its redirects: a browser
    // fetch gets { redirect, url } to act on, anything else gets a real 302
    // (oauth-provider/dist/index.mjs handleRedirect). It decides by
    // sec-fetch-mode === 'cors' — and Node's fetch sets that header on every
    // request and will not let us override it, so the backend cannot tell this
    // proxy apart from an XHR. Harmless when the browser is doing an XHR and
    // will act on the JSON itself. Fatal on a top-level navigation, such as
    // returning to /oauth2/authorize after login: the browser renders the JSON
    // as text, the authorization code sits unused on screen, and the MCP
    // client waits forever. So turn it back into the 302 the backend meant.
    if (response.ok && isTopLevelNavigation(request)) {
      const location = await redirectTargetFromBody(response);

      if (location) {
        console.log('[AUTH PROXY] JSON redirect → 302:', location);
        const redirectResponse = NextResponse.redirect(location, 302);
        applyCookies(response, redirectResponse, 'json redirect');
        return redirectResponse;
      }
    }

    // Forward the response
    const responseBody = await response.text();
    const nextResponse = new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
    });

    // Forward important headers (except set-cookie which needs special handling)
    const responseHeadersToForward = [
      'content-type',
      'cache-control',
      'expires',
      'pragma',
    ];

    responseHeadersToForward.forEach((header) => {
      const value = response.headers.get(header);
      if (value) {
        nextResponse.headers.set(header, value);
      }
    });

    // Forward all Set-Cookie headers, rewriting for same-site usage
    applyCookies(response, nextResponse, 'response');

    return nextResponse;
  } catch (error) {
    console.error('[AUTH PROXY] Error:', error);
    return NextResponse.json({ error: 'Auth proxy error' }, { status: 500 });
  }
}
