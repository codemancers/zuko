/**
 * Single public backend origin. It is also the better-auth issuer, since
 * better-auth is mounted in-process at AUTH_BASE_PATH. Every issuer/audience/
 * JWKS/redirect URL must derive from this constant, never re-read the env var.
 */
export const BACKEND_URL =
  process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;

export const AUTH_BASE_PATH = '/auth';

/** Where the Next.js app lives: the OAuth login and consent pages are served from there. */
export const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:4200';

/** The MCP endpoint. Tokens are audience-bound to this URL, so it derives from BACKEND_URL. */
export const MCP_PATH = '/api/mcp';
export const MCP_RESOURCE = `${BACKEND_URL}${MCP_PATH}`;

/** What an MCP client may be granted. The user's own permissions always apply on top. */
export const MCP_SCOPES = {
  read: 'mcp:read',
  write: 'mcp:write',
  delete: 'mcp:delete',
} as const;

/** Access-token claim carrying the organization the user chose when they connected. */
export const ORG_CLAIM = 'urn:zuko:org_id';

/** Approval generation: a replacement consent must never reactivate an older token. */
export const CONSENT_CLAIM = 'urn:zuko:consent_id';
