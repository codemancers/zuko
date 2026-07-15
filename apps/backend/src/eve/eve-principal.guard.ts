import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { verifyEvePrincipal } from '../utils/eve-principal';
import type { Request } from 'express';

/** Shape attached to `req.evePrincipal` after guard passes. */
export interface EvePrincipalContext {
  readonly userId: number;
  readonly orgId: number;
  /** Snapshot of the user's display name at auth time — used for audit actors. */
  readonly name: string | null;
  /** Snapshot of the user's email at auth time — used for audit actors. */
  readonly email: string | null;
  /** Snapshot of the user's avatar URL at auth time — used for audit actors. */
  readonly image: string | null;
}

/**
 * Reads `Authorization: EvePrincipal <token>`, verifies the HMAC-signed
 * principal (60 s TTL), re-checks org membership, and attaches
 * `{userId, orgId}` to `req.evePrincipal`.
 *
 * Security invariants (cross-tenant boundary):
 *  - 401 if header missing or wrong scheme.
 *  - 401 if token is forged or expired (`verifyEvePrincipal` throws).
 *  - 403 (`ForbiddenException`) if the principal's userId is NOT a member of
 *    the principal's orgId — prevents a valid token from being replayed
 *    against an org the user left.
 */
@Injectable()
export class EvePrincipalGuard implements CanActivate {
  constructor(private readonly databaseService: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { evePrincipal?: EvePrincipalContext }>();

    const authHeader = req.headers['authorization'];
    if (
      typeof authHeader !== 'string' ||
      !authHeader.startsWith('EvePrincipal ')
    ) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header — expected: EvePrincipal <token>',
      );
    }

    const token = authHeader.slice('EvePrincipal '.length);

    let userId: number;
    let orgId: number;
    try {
      ({ userId, orgId } = verifyEvePrincipal(token));
    } catch {
      // verifyEvePrincipal throws on bad signature or expired token —
      // surface as 401, NOT 500, so the calling tool can handle it cleanly.
      throw new UnauthorizedException('Invalid or expired eve principal token');
    }

    // Membership re-check — same query as EveProxyController (Phase 1).
    // A valid token is not sufficient: the user must still belong to the org
    // it names (e.g. they might have been removed since the token was issued).
    // We fetch the user's profile in the same query so audit actors carry the
    // real identity (name/email/image) without an extra round-trip.
    const member = await this.databaseService.member.findFirst({
      where: { userId, organizationId: orgId },
      include: {
        user: { select: { name: true, email: true, image: true } },
      },
    });

    if (!member) {
      throw new ForbiddenException('User does not belong to this organisation');
    }

    req.evePrincipal = {
      userId,
      orgId,
      name: member.user.name,
      email: member.user.email,
      image: member.user.image,
    };
    return true;
  }
}
