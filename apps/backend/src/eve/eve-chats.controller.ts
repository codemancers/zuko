import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import { EveChatsRepository } from './eve-chats.repository';

interface RequestWithUser extends Request {
  user: { id: string };
  session: { session: { activeOrganizationId?: string } };
}

function resolveIds(req: RequestWithUser): {
  userId: number;
  organizationId: number;
} {
  const userId = parseInt(req.user.id, 10);
  const orgIdRaw =
    (req.headers['x-organization-id'] as string) ||
    req.session?.session?.activeOrganizationId;
  const organizationId = orgIdRaw ? parseInt(orgIdRaw, 10) : NaN;
  if (!Number.isFinite(userId) || !Number.isFinite(organizationId)) {
    throw new BadRequestException('Could not resolve user or organization');
  }
  return { userId, organizationId };
}

/** Thin per-user index of eve sessions (the conversation lives in eve). */
@UseGuards(AuthGuard)
@Controller('eve-chats')
export class EveChatsController {
  constructor(private readonly repo: EveChatsRepository) {}

  @Post()
  async create(
    @Req() req: RequestWithUser,
    @Body()
    body: {
      sessionId?: string;
      title?: string;
      continuationToken?: string;
      streamIndex?: number;
    },
  ) {
    const { userId, organizationId } = resolveIds(req);
    const sessionId = (body.sessionId ?? '').trim();
    if (!sessionId) throw new BadRequestException('sessionId required');
    return this.repo.upsertBySessionId(
      userId,
      organizationId,
      sessionId,
      (body.title ?? '').slice(0, 80),
      {
        continuationToken: body.continuationToken,
        streamIndex: body.streamIndex,
      },
    );
  }

  @Get()
  async list(@Req() req: RequestWithUser) {
    const { userId, organizationId } = resolveIds(req);
    const sessions = await this.repo.listByUser(userId, organizationId);
    return { sessions };
  }

  @Get(':sessionId')
  async findOne(
    @Req() req: RequestWithUser,
    @Param('sessionId') sessionId: string,
  ) {
    const { userId, organizationId } = resolveIds(req);
    const row = await this.repo.getBySessionId(
      sessionId,
      userId,
      organizationId,
    );
    if (!row) throw new NotFoundException('Session not found');
    return row;
  }
}
