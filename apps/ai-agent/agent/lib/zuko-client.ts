import type { ToolContext } from 'eve/tools';
import { env } from './env';

function sessionCookieFromCtx(ctx: ToolContext): string {
  const cookie = ctx.session.auth.current?.attributes?.sessionCookie;
  if (cookie) return String(cookie);
  throw new Error(
    'Not authenticated. Start a session via the HTTP API with a valid Better Auth session cookie.',
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
  const res = await fetch(`${env().ZUKO_BACKEND_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zuko API ${method} ${path} → ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}
