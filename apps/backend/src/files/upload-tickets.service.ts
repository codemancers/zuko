import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { CrmContextService, type RequestContext } from '../crm/context';
import { CrmError } from '../crm/errors';
import { assertCanUploadFiles } from '../crm/permissions';
import { BACKEND_URL } from '../libs/better-auth/constants';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_FILE_BYTES } from './file-types';

/** How long an upload link works. It is a bearer capability, so it is kept short. */
const UPLOAD_LINK_TTL_SECONDS = 300;

const TOKEN = /^([1-9]\d{0,18})\.([1-9]\d{0,18})\.([A-Za-z0-9_-]{43})$/;
const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

const invalid = () => new CrmError(401, 'INVALID_UPLOAD_LINK', 'This upload link is not valid');
const used = () => new CrmError(410, 'UPLOAD_LINK_USED', 'This upload link has already been used; ask for a new one');
const expired = () => new CrmError(410, 'UPLOAD_LINK_EXPIRED', 'This upload link has expired; ask for a new one');

/**
 * Signed, single-use upload links. A client that cannot send the user's token (an MCP client running
 * curl) asks for one, uploads the bytes to it, and gets a file id back. The token is
 * `<organization>.<ticket>.<secret>`: the organization lets the ticket be found under tenant
 * row-level security, and only a hash of the secret is stored.
 */
@Injectable()
export class UploadTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: CrmContextService,
  ) {}

  async issue(ctx: RequestContext) {
    assertCanUploadFiles(ctx);
    const secret = randomBytes(32).toString('base64url');
    const now = Date.now();
    const expiresAt = new Date(now + UPLOAD_LINK_TTL_SECONDS * 1000);
    const ticket = await this.prisma.withTenant({ organizationId: ctx.organizationId, actorId: ctx.userId }, async (tx) => {
      // Spent and lapsed links are of no use after an hour; clear them as new ones are made.
      await tx.uploadTicket.deleteMany({ where: { organizationId: ctx.organizationId, expiresAt: { lt: new Date(now - 3_600_000) } } });
      return tx.uploadTicket.create({
        data: { organizationId: ctx.organizationId, userId: ctx.userId, secretHash: hash(secret), actorType: ctx.actorType, expiresAt },
      });
    });
    await this.prisma.auditEvent.create({
      data: { organizationId: ctx.organizationId, actorType: ctx.actorType, actorId: ctx.userId, event: 'file.upload_link.issued', targetType: 'upload_ticket', targetId: ticket.id, requestId: ctx.requestId },
    });
    return {
      upload_url: `${BACKEND_URL}/api/v1/files/uploads/${ctx.organizationId}.${ticket.id}.${secret}`,
      method: 'POST',
      field: 'file',
      expires_at: expiresAt.toISOString(),
      expires_in_seconds: UPLOAD_LINK_TTL_SECONDS,
      max_bytes: MAX_FILE_BYTES,
      single_use: true,
    };
  }

  /**
   * Spend a link: it works once, only before it expires, and only with the right secret. Returns who the
   * upload is for, as if that user had made the request. A link that fails reveals nothing about why
   * unless its secret was right.
   */
  async claim(token: string): Promise<RequestContext> {
    const match = TOKEN.exec(token);
    if (!match) throw invalid();
    const organizationId = BigInt(match[1]);
    const id = BigInt(match[2]);
    const secretHash = hash(match[3]);

    const outcome = await this.prisma.withTenant({ organizationId }, async (tx) => {
      const ticket = await tx.uploadTicket.findFirst({ where: { id, organizationId } });
      if (!ticket || !sameHash(ticket.secretHash, secretHash)) return { kind: 'invalid' as const };
      if (ticket.usedAt) return { kind: 'used' as const };
      if (ticket.expiresAt.getTime() <= Date.now()) return { kind: 'expired' as const };
      // Atomic: of two simultaneous uploads, exactly one flips usedAt.
      const claimed = await tx.uploadTicket.updateMany({
        where: { id, organizationId, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      return claimed.count === 1 ? { kind: 'ok' as const, ticket } : { kind: 'used' as const };
    });
    if (outcome.kind === 'invalid') throw invalid();
    if (outcome.kind === 'used') throw used();
    if (outcome.kind === 'expired') throw expired();
    const { ticket } = outcome;
    const actorType = (['USER', 'MCP', 'AGENT'] as const).find((t) => t === ticket.actorType) ?? 'MCP';
    return this.contexts.build({ userId: ticket.userId, organizationId, actorType });
  }
}
