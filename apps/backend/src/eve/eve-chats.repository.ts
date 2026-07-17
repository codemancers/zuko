import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EveChatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertBySessionId(
    userId: number,
    organizationId: number,
    sessionId: string,
    title: string,
    cursor: { continuationToken?: string; streamIndex?: number },
  ) {
    return this.prisma.eveChat.upsert({
      where: { sessionId },
      create: {
        sessionId,
        title,
        createdById: userId,
        organizationId,
        continuationToken: cursor.continuationToken,
        streamIndex: cursor.streamIndex,
      },
      update: {
        ...(cursor.continuationToken !== undefined
          ? { continuationToken: cursor.continuationToken }
          : {}),
        ...(cursor.streamIndex !== undefined
          ? { streamIndex: cursor.streamIndex }
          : {}),
      },
      select: { sessionId: true },
    });
  }

  listByUser(userId: number, organizationId: number) {
    return this.prisma.eveChat.findMany({
      where: { createdById: userId, organizationId },
      select: { sessionId: true, title: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  getBySessionId(sessionId: string, userId: number, organizationId: number) {
    return this.prisma.eveChat.findFirst({
      where: { sessionId, createdById: userId, organizationId },
      select: {
        sessionId: true,
        title: true,
        continuationToken: true,
        streamIndex: true,
      },
    });
  }
}
