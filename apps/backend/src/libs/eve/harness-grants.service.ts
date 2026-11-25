import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { verifyBearerToken } from 'better-auth/oauth2';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { Auth } from '../better-auth/auth';
import {
  AGENT_SCOPE,
  AUTH_ISSUER,
  BACKEND_URL,
  CRM_RESOURCE,
  CRM_SCOPES,
  ORG_CLAIM,
} from '../better-auth/constants';
import { PrismaService } from '../../prisma/prisma.service';
import type { PrismaClient } from '../../generated/prisma/client';
import { runInTenant } from '../../prisma/tenant-transaction';
import { CrmError } from '../../crm/errors';
import { parseId } from '../../crm/ids';

export const GRANT_CLAIM = 'urn:zuko:harness_grant';

export async function createHarnessGrant(
  prisma: PrismaClient,
  userId: bigint,
  organizationId: bigint,
  sourceType: 'session' | 'consent',
  sourceId: bigint,
  scopes: string[],
  expiresAt: Date,
) {
  const scopesKey = [...scopes].sort().join(' ');
  return runInTenant(prisma, { organizationId }, (tx) =>
    tx.harnessGrant.upsert({
      where: {
        organizationId_sourceType_sourceId_scopesKey: {
          organizationId,
          sourceType,
          sourceId,
          scopesKey,
        },
      },
      create: {
        userId,
        organizationId,
        sourceType,
        sourceId,
        scopes,
        scopesKey,
        reference: randomUUID(),
        expiresAt,
      },
      update: { expiresAt },
    }),
  );
}

@Injectable()
export class HarnessGrantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService<Auth>,
  ) {}

  requireService(value: unknown, peer = 'unknown') {
    const ip = peer.replace(/^::ffff:/, '');
    const allowed = process.env.HARNESS_ALLOWED_IPS?.split(',')
      .map((entry) => entry.trim().replace(/^::ffff:/, ''))
      .filter(Boolean);
    if (allowed?.length && !allowed.includes(ip))
      throw new CrmError(403, 'FORBIDDEN', 'Delegation is restricted to configured harness peers');
    const expected = process.env.EVE_AUTH_SECRET?.trim();
    if (!expected || Buffer.byteLength(expected) < 32 || typeof value !== 'string')
      throw new UnauthorizedException();
    const a = Buffer.from(value);
    const keys = [expected, process.env.EVE_AUTH_SECRET_PREVIOUS?.trim()].filter(
      (key): key is string => !!key && Buffer.byteLength(key) >= 32,
    );
    if (
      !keys.some((key) => {
        const b = Buffer.from(key);
        return a.length === b.length && timingSafeEqual(a, b);
      })
    )
      throw new UnauthorizedException();
  }

  async verify(token: string, audience: string) {
    try {
      return await verifyBearerToken(token, {
        jwksUrl: `${BACKEND_URL}/auth/jwks`,
        verifyOptions: { issuer: AUTH_ISSUER, audience, algorithms: ['EdDSA', 'ES256', 'RS256'] },
      });
    } catch (error) {
      const failure = error as { status?: string; body?: { error?: string } };
      if (failure.status === 'UNAUTHORIZED' && failure.body?.error === 'invalid_token')
        throw new UnauthorizedException('Invalid delegation token');
      throw error;
    }
  }

  create(
    userId: bigint,
    organizationId: bigint,
    sourceType: 'session' | 'consent',
    sourceId: bigint,
    scopes: string[],
    expiresAt: Date,
  ) {
    return createHarnessGrant(
      this.prisma,
      userId,
      organizationId,
      sourceType,
      sourceId,
      scopes,
      expiresAt,
    );
  }

  async resolve(reference: unknown, organization: unknown) {
    const organizationId = parseId(organization);
    if (typeof reference !== 'string' || !organizationId) throw new UnauthorizedException();
    const grant = await this.prisma.withTenant({ organizationId }, (tx) =>
      tx.harnessGrant.findUnique({ where: { reference } }),
    );
    if (
      !grant ||
      grant.expiresAt.getTime() <= Date.now() ||
      !grant.scopes.every((scope) => [...Object.values(CRM_SCOPES), AGENT_SCOPE].includes(scope))
    )
      throw new UnauthorizedException('Delegation expired');
    if (grant.sourceType === 'session') {
      const session = await this.prisma.session.findFirst({
        where: { id: grant.sourceId, userId: grant.userId, expiresAt: { gt: new Date() } },
      });
      if (!session || session.activeOrganizationId !== organizationId)
        throw new UnauthorizedException('Session ended or organization changed');
    } else {
      const consent = await this.prisma.oauthConsent.findFirst({
        where: {
          id: grant.sourceId,
          userId: grant.userId,
          referenceId: String(organizationId),
          oauthclient: { disabled: { not: true } },
        },
      });
      if (!consent || !grant.scopes.every((scope) => consent.scopes.includes(scope)))
        throw new UnauthorizedException('Connection revoked');
    }
    return grant;
  }

  async sign(
    grant: Awaited<ReturnType<HarnessGrantsService['resolve']>>,
    audience: string,
    seconds: number,
  ) {
    const now = Math.floor(Date.now() / 1000);
    const { token } = await this.auth.api.signJWT({
      body: {
        payload: {
          sub: String(grant.userId),
          [ORG_CLAIM]: String(grant.organizationId),
          [GRANT_CLAIM]: grant.reference,
          scope: grant.scopes.join(' '),
          iat: now,
          exp: now + seconds,
          jti: randomUUID(),
        },
        overrideOptions: { jwt: { issuer: AUTH_ISSUER, audience } },
      },
    });
    return { access_token: token, expires_at: (now + seconds) * 1000 };
  }

  async delegation(token: string, requiredScope: string) {
    const claims = await this.verify(token, CRM_RESOURCE);
    const grant = await this.resolve(claims[GRANT_CLAIM], claims[ORG_CLAIM]);
    // This is a backend-issued CRM token, not the original MCP client access token.
    const tokenScopes = typeof claims.scope === 'string' ? claims.scope.split(/\s+/) : [];
    if (
      String(grant.userId) !== claims.sub ||
      !tokenScopes.includes(requiredScope) ||
      !grant.scopes.includes(requiredScope)
    )
      throw new CrmError(403, 'INSUFFICIENT_SCOPE', `This delegation requires ${requiredScope}`);
    return grant;
  }
}
