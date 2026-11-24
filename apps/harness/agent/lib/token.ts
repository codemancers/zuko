import { createHmac, randomUUID } from 'node:crypto';

export const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
export const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
export const eveIssuer = `${backendUrl}/eve`;
export const eveRouteAudience = `${frontendUrl}/eve`;
export const zukoMcpUrl = `${backendUrl}/api/mcp`;
export const userClaim = 'zuko_user_id';
export const organizationClaim = 'zuko_organization_id';

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function eveSecret(): string {
  const value = process.env.EVE_AUTH_SECRET?.trim();
  if (!value || Buffer.byteLength(value, 'utf8') < 32) {
    throw new Error('EVE_AUTH_SECRET must be at least 32 bytes');
  }
  return value;
}

export function signMcpToken(userId: string, organizationId: string) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60;
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    iss: eveIssuer,
    aud: zukoMcpUrl,
    sub: `user:${userId}:organization:${organizationId}`,
    iat: now,
    exp: expiresAt,
    jti: randomUUID(),
    [userClaim]: userId,
    [organizationClaim]: organizationId,
    scope: 'mcp:read mcp:write mcp:delete',
  });
  const unsigned = `${header}.${payload}`;
  const signature = createHmac('sha256', eveSecret()).update(unsigned).digest('base64url');
  return { token: `${unsigned}.${signature}`, expiresAt: expiresAt * 1000 };
}
