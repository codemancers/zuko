import type { ClaudeAiOauth } from './dto/upsert-account-oauth.dto';

// Claude Code's PKCE OAuth client. Confirmed by reading the `claude` binary
// that the CLI installs (the `claude login` flow uses this same constant
// for both initial auth and refresh).
export const CLAUDE_OAUTH_TOKEN_URL =
  'https://platform.claude.com/v1/oauth/token';
export const CLAUDE_OAUTH_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

// Refresh slightly ahead of true expiry so claims dispatched within the last
// 60s of validity don't race the 401 response in the runner.
export const REFRESH_LEEWAY_MS = 60_000;

export interface ClaudeAccountRow {
  id: number;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  scope: string | null;
}

/**
 * The two reads + one write the refresh flow needs, abstracted over the data
 * layer. The request path backs this with Prisma (the shared `zuko-backend`
 * pool); workflow step bodies back it with raw `pg` (steps are bundled
 * separately and MUST NOT import `@zuko/models` — see step-db.ts). One
 * control flow, two stores.
 */
export interface ClaudeOauthStore {
  read(userId: number): Promise<ClaudeAccountRow | null>;
  persist(id: number, oauth: ClaudeAiOauth): Promise<void>;
}

/**
 * Return the user's Claude OAuth blob, refreshing it against Anthropic if the
 * access token is expired (or expires within `REFRESH_LEEWAY_MS`). Persists the
 * rotated token back to the `account` row.
 *
 * This mirrors how Better Auth refreshes every other provider's token (see
 * better-auth `getAccessToken`): an optimistic read → refresh → update — no
 * dedicated pool, no SELECT … FOR UPDATE, no lock held across the network call.
 *
 * The one wrinkle Better Auth's providers (Google, GitHub, …) don't have:
 * Anthropic *single-uses* the refresh_token — it rotates and invalidates the
 * old one on every refresh. So two requests refreshing the same user
 * concurrently race, and the loser's refresh_token is already dead by the time
 * it calls Anthropic. We recover without a lock: if our refresh throws, re-read
 * the row — the winner has almost certainly just written a fresh token, so we
 * return that instead of surfacing a spurious error. If the re-read is still
 * stale, the failure is real and we rethrow.
 *
 * Throws "Claude not connected" if no usable row exists. Throws on a genuine
 * refresh failure with an actionable "Reconnect Claude under Settings"
 * message — callers should surface it verbatim.
 */
export async function getValidClaudeOauthWithStore(
  store: ClaudeOauthStore,
  userId: number,
): Promise<ClaudeAiOauth> {
  const account = await store.read(userId);
  if (!account?.accessToken || !account.refreshToken) {
    throw new Error('Claude not connected. Add it under Settings.');
  }

  if (isFresh(account.accessTokenExpiresAt)) {
    return rowToOauth(account);
  }

  // Stale: refresh against Anthropic, persist the rotated row, return.
  try {
    const refreshed = await fetchRefreshFromAnthropic(account.refreshToken);
    await store.persist(account.id, refreshed);
    return refreshed;
  } catch (err) {
    // A concurrent caller may have rotated the refresh_token out from under us
    // (Anthropic invalidates it on use). If the row is now fresh, that race —
    // not a real failure — is what we hit; return the winner's token.
    const latest = await store.read(userId);
    if (
      latest?.accessToken &&
      latest.refreshToken &&
      isFresh(latest.accessTokenExpiresAt)
    ) {
      return rowToOauth(latest);
    }
    throw err;
  }
}


function isFresh(expiresAt: Date | null): boolean {
  return (expiresAt?.getTime() ?? 0) - Date.now() > REFRESH_LEEWAY_MS;
}

// Callers guard that accessToken/refreshToken are present before calling.
function rowToOauth(row: ClaudeAccountRow): ClaudeAiOauth {
  return {
    accessToken: row.accessToken ?? '',
    refreshToken: row.refreshToken ?? '',
    expiresAt: row.accessTokenExpiresAt?.getTime() ?? 0,
    scopes: row.scope ? row.scope.split(' ').filter(Boolean) : [],
  };
}

async function fetchRefreshFromAnthropic(
  refreshToken: string,
): Promise<ClaudeAiOauth> {
  const res = await fetch(CLAUDE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLAUDE_OAUTH_CLIENT_ID,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Claude OAuth refresh failed (${res.status} ${res.statusText}): ${detail.slice(0, 200)}. Reconnect Claude under Settings.`,
    );
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  if (!data.access_token || !data.expires_in) {
    throw new Error(
      'Claude OAuth refresh: malformed response (missing access_token or expires_in).',
    );
  }
  // Anthropic rotates refresh_token on each refresh; fall back to the
  // submitted one only if the response omits it (defensive — observed
  // behavior is that they always rotate).
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    scopes:
      typeof data.scope === 'string'
        ? data.scope.split(' ').filter(Boolean)
        : [],
  };
}
