/**
 * Helpers for the /auth proxy (app/auth/[...auth]/route.ts).
 *
 * Kept out of the route module so they can be unit tested: Next only lets a
 * route file export its HTTP handlers.
 */

/**
 * A document navigation, as opposed to an XHR the page will handle itself.
 * Mirrors the test better-auth makes internally: trust sec-fetch-mode when the
 * browser sends it, otherwise fall back to the Accept header.
 */
export function isTopLevelNavigation(request: {
  method: string;
  headers: Headers;
}) {
  if (request.method !== 'GET') return false;

  const mode = request.headers.get('sec-fetch-mode')?.toLowerCase();
  if (mode) return mode === 'navigate';

  const accept = request.headers.get('accept')?.toLowerCase() ?? '';
  return (
    accept.includes('text/html') || accept.includes('application/xhtml+xml')
  );
}

/**
 * The `url` of a `{ redirect: true, url }` body, or null for anything else.
 *
 * Reads a clone so the caller can still stream the original body through.
 */
export async function redirectTargetFromBody(response: Response) {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    return null;
  }

  try {
    const body = await response.clone().json();
    return body?.redirect === true && typeof body.url === 'string'
      ? body.url
      : null;
  } catch {
    return null;
  }
}

/** Re-scope a backend cookie onto this origin. */
export function rewriteCookieForProxy(cookie: string) {
  return cookie
    .split(';')
    .map((part) => part.trim())
    .filter((part) => !part.toLowerCase().startsWith('domain='))
    .map((part) =>
      part.toLowerCase() === 'samesite=none' ? 'SameSite=Lax' : part,
    )
    .join('; ');
}
