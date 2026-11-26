/** Canonical issuer origin. Resource audiences instead use the origin that owns each API. */
export const BACKEND_URL =
  process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;

export const AUTH_BASE_PATH = '/auth';

/** Where the Next.js app lives: the OAuth login and consent pages are served from there. */
export const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:4200';

/** What an MCP client may be granted. The user's own permissions always apply on top. */
export const CRM_SCOPES = {
  recordsRead: 'records:read',
  recordsWrite: 'records:write',
  recordsDelete: 'records:delete',
  commentsRead: 'comments:read',
  commentsWrite: 'comments:write',
  schemaRead: 'schema:read',
  directoryRead: 'directory:read',
} as const;

/** Access-token claim carrying the organization the user chose when they connected. */
export const ORG_CLAIM = 'urn:zuko:org_id';

/** Approval generation: a replacement consent must never reactivate an older token. */
export const CONSENT_CLAIM = 'urn:zuko:consent_id';

export const AUTH_ISSUER = `${BACKEND_URL}${AUTH_BASE_PATH}`;
export const HARNESS_RESOURCE = `${FRONTEND_ORIGIN}/eve/v1/mcp`;
export const HARNESS_ROUTE_RESOURCE = `${FRONTEND_ORIGIN}/eve`;
export const CRM_RESOURCE = `${BACKEND_URL}/api/v1`;
export const AGENT_SCOPE = 'agent:invoke';
