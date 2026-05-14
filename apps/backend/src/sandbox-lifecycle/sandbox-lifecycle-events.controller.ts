import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Request, Response } from 'express';
import type { RequestWithUser } from '@zuko/core';
import { PrismaService } from '../prisma/prisma.service';
import {
  SandboxLifecycleService,
  type SandboxLifecyclePayload,
} from './sandbox-lifecycle.service';
import { SANDBOX_LIFECYCLE_EVENT } from './sandbox-lifecycle.constants';

@Controller('sandboxes')
@UseGuards(AuthGuard)
export class SandboxLifecycleEventsController {
  constructor(
    private readonly lifecycleService: SandboxLifecycleService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * GET /api/sandboxes/:id/lifecycle/events
   * SSE stream of lifecycle state changes for the given sandbox.
   * Sends the current state immediately on connect, then streams updates.
   */
  @Get(':id/lifecycle/events')
  async lifecycleEvents(
    @Param('id') rawId: string,
    @Req() req: Request & RequestWithUser,
    @Res() res: Response,
  ) {
    const sandboxId = parseInt(rawId, 10);
    const sandbox = await this.prisma.sandbox.findUnique({
      where: { id: sandboxId },
      include: {
        chats: {
          include: { participants: true },
        },
      },
    });
    if (!sandbox) {
      throw new NotFoundException('Sandbox not found');
    }

    const userId = parseInt(req.user.id, 10);
    const hasAccess = sandbox.chats.some((chat) =>
      chat.participants.some((p) => p.userId === userId),
    );
    if (!hasAccess) {
      throw new ForbiddenException();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send current DB state immediately so the client has something to render
    res.write(
      `data: ${JSON.stringify({
        sandboxId,
        lifecycleState: sandbox.lifecycleState,
        lifecycleError: sandbox.lifecycleError,
      })}\n\n`,
    );

    // Reconcile with actual Fly state asynchronously — if the sprite is cold
    // but DB says active, this emits a correction event within milliseconds.
    this.lifecycleService.reconcileWithFly(sandboxId).catch(() => {});

    const eventName = `${SANDBOX_LIFECYCLE_EVENT}.${sandboxId}`;
    const listener = (payload: SandboxLifecyclePayload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };
    this.events.on(eventName, listener);

    req.on('close', () => {
      this.events.off(eventName, listener);
      res.end();
    });
  }

  /**
   * POST /api/sandboxes/:id/resume
   * Manually wake a hibernated sandbox.
   */
  @Post(':id/resume')
  async resume(@Param('id') rawId: string, @Req() req: RequestWithUser) {
    const sandboxId = parseInt(rawId, 10);
    const sandbox = await this.prisma.sandbox.findUnique({
      where: { id: sandboxId },
      include: { chats: { include: { participants: true } } },
    });
    if (!sandbox) throw new NotFoundException('Sandbox not found');

    const userId = parseInt(req.user.id, 10);
    const hasAccess = sandbox.chats.some((chat) =>
      chat.participants.some((p) => p.userId === userId),
    );
    if (!hasAccess) throw new ForbiddenException();

    await this.lifecycleService.resume(sandboxId);
    return { ok: true };
  }
}
