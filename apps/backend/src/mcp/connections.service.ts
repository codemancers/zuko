import { Injectable } from '@nestjs/common';
import { notFound } from '../crm/errors';
import { toId } from '../crm/records.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The applications (MCP clients) a user has approved. One approval, a "consent", exists
 * per user, client and organization; it is what lets that client's tokens work.
 */
@Injectable()
export class ConnectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: bigint) {
    const consents = await this.prisma.oauthConsent.findMany({
      where: { userId },
      include: { oauthclient: { select: { clientId: true, name: true, uri: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const organizationIds = [
      ...new Set(consents.flatMap((c) => (c.referenceId && /^[1-9]\d*$/.test(c.referenceId) ? [BigInt(c.referenceId)] : []))),
    ];
    const organizations = await this.prisma.organization.findMany({
      where: { id: { in: organizationIds } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(organizations.map((o) => [String(o.id), o.name]));

    return {
      results: consents.map((c) => ({
        id: String(c.id),
        client: { id: c.clientId, name: c.oauthclient.name ?? null, uri: c.oauthclient.uri ?? null },
        organization: c.referenceId ? { id: c.referenceId, name: nameOf.get(c.referenceId) ?? null } : null,
        scopes: c.scopes,
        connected_at: c.createdAt.toISOString(),
        updated_at: c.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Disconnect: remove the approval and the tokens issued under it. Access tokens are
   * signed JWTs that stay valid until they expire, so the MCP endpoint also checks that
   * the approval still exists on every request; that is what makes this immediate.
   */
  async disconnect(userId: bigint, rawId: string) {
    const consentId = toId(rawId, 'connection');
    const consent = await this.prisma.oauthConsent.findFirst({ where: { id: consentId, userId } });
    if (!consent) {
      throw notFound('No such connection');
    }
    const issuedUnder = { userId, clientId: consent.clientId, referenceId: consent.referenceId };
    await this.prisma.$transaction([
      this.prisma.oauthAccessToken.deleteMany({ where: issuedUnder }),
      this.prisma.oauthRefreshToken.deleteMany({ where: issuedUnder }),
      this.prisma.oauthConsent.delete({ where: { id: consentId } }),
    ]);
    return { id: String(consentId), deleted: true };
  }
}
