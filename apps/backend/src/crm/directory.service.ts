import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from './context';
import { assertCan } from './permissions';

/** The people and teams of the organization, e.g. to find an id to assign a record to. */
@Injectable()
export class DirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  async members(ctx: RequestContext) {
    assertCan(ctx, { record: ['read'] }, 'view members');
    const rows = await this.prisma.member.findMany({
      where: { organizationId: ctx.organizationId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { id: 'asc' },
    });
    return {
      results: rows.map((m) => ({
        user_id: String(m.user.id),
        name: m.user.name,
        email: m.user.email,
        roles: m.role.split(',').map((r) => r.trim()),
        is_me: m.user.id === ctx.userId,
      })),
    };
  }

  async teams(ctx: RequestContext) {
    assertCan(ctx, { record: ['read'] }, 'view teams');
    const rows = await this.prisma.team.findMany({
      where: { organizationId: ctx.organizationId },
      include: { members: { select: { userId: true } } },
      orderBy: { id: 'asc' },
    });
    return {
      results: rows.map((t) => ({
        id: String(t.id),
        name: t.name,
        member_count: t.members.length,
        is_member: t.members.some((m) => m.userId === ctx.userId),
      })),
    };
  }
}
