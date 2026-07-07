import type { ToolContext } from 'eve/tools';
import { env } from './env';

export function orgIdFromCtx(ctx: ToolContext): number {
  const raw = ctx.session.auth.current?.attributes?.orgId;
  if (raw) return Number(raw);
  const fromEnv = env().ZUKO_ORG_ID;
  if (fromEnv) return fromEnv;
  throw new Error('No org id: authenticate via Better Auth session or set ZUKO_ORG_ID.');
}

function sessionCookieFromCtx(ctx: ToolContext): string {
  const cookie = ctx.session.auth.current?.attributes?.sessionCookie;
  if (cookie) return String(cookie);
  throw new Error('No session cookie: authenticate via Better Auth session.');
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
