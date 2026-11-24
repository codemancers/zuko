const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

interface TokenResponse {
  access_token: string;
  expires_at: number;
}

const tokens = new Map<string, TokenResponse>();

/** Fetch a short-lived agent token using the browser's normal Zuko session cookie. */
export async function getEveAccessToken(scope: string): Promise<string> {
  if (!scope) throw new Error('An active Zuko organization is required');
  const cached = tokens.get(scope);
  if (cached && cached.expires_at > Date.now() + 30_000) return cached.access_token;

  const response = await fetch(`${BACKEND_URL}/api/v1/eve/token`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'Could not connect to the Zuko agent');
  }
  const token = (await response.json()) as TokenResponse;
  if (
    typeof token.access_token !== 'string' ||
    !token.access_token ||
    !Number.isFinite(token.expires_at) ||
    token.expires_at <= Date.now()
  ) {
    throw new Error('The Zuko agent returned an invalid access token');
  }
  tokens.set(scope, token);
  return token.access_token;
}

export function clearEveAccessTokens() {
  tokens.clear();
}
