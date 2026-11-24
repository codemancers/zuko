import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { BACKEND_URL, FRONTEND_ORIGIN, MCP_RESOURCE, MCP_SCOPES } from '../better-auth/constants';

export const EVE_ISSUER = `${BACKEND_URL}/eve`;
export const EVE_ROUTE_AUDIENCE = `${FRONTEND_ORIGIN}/eve`;
export const EVE_USER_CLAIM = 'zuko_user_id';
export const EVE_ORGANIZATION_CLAIM = 'zuko_organization_id';

interface EveClaims {
  iss: string;
  aud: string;
  sub: string;
  iat: number;
  exp: number;
  jti: string;
  [EVE_USER_CLAIM]: string;
  [EVE_ORGANIZATION_CLAIM]: string;
  scope?: string;
}

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

function secret(): string | undefined {
  const value = process.env.EVE_AUTH_SECRET?.trim();
  return value && Buffer.byteLength(value, 'utf8') >= 32 ? value : undefined;
}

/** A stable principal per person and organization prevents conversations crossing org switches. */
export function eveSubject(userId: bigint, organizationId: bigint): string {
  return `user:${userId}:organization:${organizationId}`;
}

function sign(claims: EveClaims, key: string): string {
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}`;
  const signature = createHmac('sha256', key).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

export function issueEveRouteToken(userId: bigint, organizationId: bigint) {
  const key = secret();
  if (!key) return undefined;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 5 * 60;
  return {
    token: sign(
      {
        iss: EVE_ISSUER,
        aud: EVE_ROUTE_AUDIENCE,
        sub: eveSubject(userId, organizationId),
        iat: now,
        exp: expiresAt,
        jti: randomUUID(),
        [EVE_USER_CLAIM]: String(userId),
        [EVE_ORGANIZATION_CLAIM]: String(organizationId),
      },
      key,
    ),
    expiresAt: expiresAt * 1000,
  };
}

function parseJsonPart(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function matchesAudience(value: unknown, expected: string): boolean {
  return value === expected || (Array.isArray(value) && value.includes(expected));
}

/** Verify the private Eve-to-MCP delegation token. External MCP OAuth remains unchanged. */
export function verifyEveMcpToken(token: string | undefined): EveClaims | undefined {
  const key = secret();
  if (!key || !token || token.length > 16_384) return undefined;
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  const [encodedHeader, encodedPayload, signature] = parts;
  if (!encodedHeader || !encodedPayload || !signature) return undefined;

  const header = parseJsonPart(encodedHeader);
  const payload = parseJsonPart(encodedPayload);
  if (header?.['alg'] !== 'HS256' || header['typ'] !== 'JWT' || !payload) return undefined;

  const actual = Buffer.from(signature, 'base64url');
  const expected = createHmac('sha256', key).update(`${encodedHeader}.${encodedPayload}`).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return undefined;

  const now = Math.floor(Date.now() / 1000);
  if (
    payload['iss'] !== EVE_ISSUER ||
    !matchesAudience(payload['aud'], MCP_RESOURCE) ||
    typeof payload['sub'] !== 'string' ||
    typeof payload['iat'] !== 'number' ||
    typeof payload['exp'] !== 'number' ||
    payload['iat'] > now + 30 ||
    payload['exp'] <= now - 30 ||
    typeof payload[EVE_USER_CLAIM] !== 'string' ||
    typeof payload[EVE_ORGANIZATION_CLAIM] !== 'string' ||
    typeof payload['scope'] !== 'string'
  ) {
    return undefined;
  }

  const claims = payload as unknown as EveClaims;
  const expectedSubject = `user:${claims[EVE_USER_CLAIM]}:organization:${claims[EVE_ORGANIZATION_CLAIM]}`;
  const scopes = new Set(claims.scope?.split(/\s+/).filter(Boolean));
  if (
    claims.sub !== expectedSubject ||
    !scopes.has(MCP_SCOPES.read) ||
    ![...scopes].every((scope) => Object.values(MCP_SCOPES).includes(scope as never))
  ) {
    return undefined;
  }
  return claims;
}

export function bearerToken(value: string | string[] | undefined): string | undefined {
  const header = Array.isArray(value) ? value[0] : value;
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}
