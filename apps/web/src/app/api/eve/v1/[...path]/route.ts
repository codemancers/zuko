import { cookies, headers } from 'next/headers';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface BetterAuthSession {
  user: { id: string };
  session: { activeOrganizationId?: string };
}

/**
 * Same-origin catch-all proxy for every eve client call (`/api/eve/v1/*`):
 * session create/continue, the NDJSON stream, info, health.
 *
 * Forwards session cookie so the backend's EveProxyController owns auth
 * (validates the session, resolves org membership, signs x-eve-principal).
 * The response body — including the live NDJSON stream — is piped through
 * unbuffered.
 *
 * Org resolution: better-auth stores activeOrganizationId on the session
 * record (not a separate cookie), so we fetch the session once per request
 * to derive x-org-id for the backend's resolveOrgId().
 */
async function proxy(req: Request, path: string[]): Promise<Response> {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const cookieStore = await cookies();

  // Resolve active org from session — backend needs x-org-id header.
  let orgId = '';
  try {
    const sessionRes = await fetch(`${BACKEND_URL}/auth/get-session`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (sessionRes.ok) {
      const data = (await sessionRes.json()) as BetterAuthSession | null;
      orgId = data?.session?.activeOrganizationId ?? '';
    }
  } catch {
    // non-fatal — backend will 400 if x-org-id missing
  }

  const { search } = new URL(req.url);
  const target = `${BACKEND_URL}/api/eve/v1/${path.map(encodeURIComponent).join('/')}${search}`;

  const init: RequestInit = {
    method: req.method,
    headers: {
      cookie: cookieHeader,
      'x-org-id': orgId,
      ...(req.method === 'POST' ? { 'content-type': 'application/json' } : {}),
    },
  };
  if (req.method === 'POST') init.body = await req.text();

  const upstream = await fetch(target, init);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(req, path);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(req, path);
}
