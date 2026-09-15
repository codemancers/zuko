// NOTE: keep byte-identical (logic) with apps/backend/src/utils/eve-principal.ts — duplicated across the eve/backend build boundary (eve bundles separately and cannot import backend code).
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface EvePrincipal {
  readonly userId: number;
  readonly orgId: number;
}

const MAX_PRINCIPAL_AGE_MS = 60_000;

function secret(): string {
  const s = process.env['BETTER_AUTH_SECRET'];
  if (!s) throw new Error('eve-principal: BETTER_AUTH_SECRET is required');
  return s;
}

function hmac(payloadB64: string): string {
  return createHmac('sha256', secret()).update(payloadB64).digest('hex');
}

export function signEvePrincipal(p: EvePrincipal): string {
  const payloadB64 = Buffer.from(
    JSON.stringify({ userId: p.userId, orgId: p.orgId, iat: Date.now() }),
  ).toString('base64url');
  return `${payloadB64}.${hmac(payloadB64)}`;
}

export function verifyEvePrincipal(token: string): EvePrincipal {
  const dotIdx = token.indexOf('.');
  if (dotIdx === -1 || token.indexOf('.', dotIdx + 1) !== -1)
    throw new Error('eve-principal: malformed token');
  const b64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expected = hmac(b64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('eve-principal: invalid signature');
  }
  const { userId, orgId, iat } = JSON.parse(
    Buffer.from(b64, 'base64url').toString(),
  );
  if (typeof userId !== 'number' || typeof orgId !== 'number') {
    throw new Error('eve-principal: invalid payload');
  }
  if (typeof iat !== 'number' || Date.now() - iat > MAX_PRINCIPAL_AGE_MS) {
    throw new Error('eve-principal: expired token');
  }
  return { userId, orgId };
}
