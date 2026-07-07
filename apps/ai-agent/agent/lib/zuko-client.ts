import type { ToolContext } from 'eve/tools';
import { env } from './env';

function sessionCookieFromCtx(ctx: ToolContext): string {
  const cookie = ctx.session.auth.current?.attributes?.sessionCookie;
  if (cookie) return String(cookie);
  const fromEnv = env().ZUKO_SESSION_TOKEN;
  if (fromEnv) return `better-auth.session_token=${fromEnv}`;
  throw new Error(
    'Not authenticated. Set ZUKO_SESSION_TOKEN in .env (copy better-auth.session_token from browser DevTools → Application → Cookies).',
  );
}

export async function zukoFetch<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  ctx?: ToolContext,
): Promise<T> {
  const headers: Record<string, string> = {
    cookie: sessionCookieFromCtx(ctx!),
  };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(`${env().ZUKO_BACKEND_URL}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zuko API ${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return (await res.json()) as T;
}
