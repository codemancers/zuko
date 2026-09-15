import { EvePrincipal, signEvePrincipal } from './eve-principal';

/**
 * Fetch the session user's Claude OAuth blob from the Gather backend, authed by
 * a short-lived HMAC EvePrincipal token. Returns the inner blob (the caller
 * wraps it as `{ claudeAiOauth: blob }` for the sprite creds file).
 */
export async function fetchClaudeOauth(p: EvePrincipal): Promise<unknown> {
  const backendUrl = process.env['ZUKO_BACKEND_URL'];
  if (!backendUrl) {
    throw new Error('zuko-api: ZUKO_BACKEND_URL is not set');
  }
  const url = `${backendUrl}/api/internal/eve/claude-oauth`;
  const res = await fetch(url, {
    headers: { Authorization: `EvePrincipal ${signEvePrincipal(p)}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`zuko-api: GET ${url} → HTTP ${res.status}: ${body}`);
  }
  return res.json();
}
