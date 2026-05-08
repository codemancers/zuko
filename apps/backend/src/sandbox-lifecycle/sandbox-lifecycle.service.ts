import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SpritesService } from '../sprites/sprites.service';
import {
  SANDBOX_INACTIVITY_TIMEOUT_MS,
  SANDBOX_LIFECYCLE_EVENT,
} from './sandbox-lifecycle.constants';

export interface SandboxLifecyclePayload {
  sandboxId: number;
  lifecycleState: string;
  lifecycleError?: string | null;
}

@Injectable()
export class SandboxLifecycleService {
  private readonly logger = new Logger(SandboxLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sprites: SpritesService,
    private readonly events: EventEmitter2,
  ) {}

  async markActive(sandboxId: number): Promise<void> {
    const hibernateAfter = new Date(Date.now() + SANDBOX_INACTIVITY_TIMEOUT_MS);
    await this.prisma.sandbox.update({
      where: { id: sandboxId },
      data: {
        lifecycleState: 'active',
        lastActivityAt: new Date(),
        hibernateAfter,
        lifecycleError: null,
      },
    });
    this.emit(sandboxId, 'active');
  }

  async hibernate(sandboxId: number): Promise<void> {
    const sandbox = await this.prisma.sandbox.findUnique({
      where: { id: sandboxId },
    });
    if (!sandbox) return;
    if (
      sandbox.lifecycleState === 'hibernated' ||
      sandbox.lifecycleState === 'hibernating'
    ) {
      return;
    }

    try {
      await this.prisma.sandbox.update({
        where: { id: sandboxId },
        data: { lifecycleState: 'hibernating' },
      });
      this.emit(sandboxId, 'hibernating');

      await this.sprites.stopSprite(sandbox.name);

      await this.prisma.sandbox.update({
        where: { id: sandboxId },
        data: { lifecycleState: 'hibernated', hibernateAfter: null },
      });
      this.emit(sandboxId, 'hibernated');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to hibernate sandbox ${sandboxId}: ${message}`,
      );
      await this.prisma.sandbox.update({
        where: { id: sandboxId },
        data: { lifecycleState: 'failed', lifecycleError: message },
      });
      this.emit(sandboxId, 'failed', message);
    }
  }

  async resume(sandboxId: number): Promise<void> {
    const sandbox = await this.prisma.sandbox.findUnique({
      where: { id: sandboxId },
    });
    if (!sandbox) return;
    if (sandbox.lifecycleState !== 'hibernated') return;

    try {
      await this.prisma.sandbox.update({
        where: { id: sandboxId },
        data: { lifecycleState: 'restoring' },
      });
      this.emit(sandboxId, 'restoring');

      await this.sprites.startSprite(sandbox.name);

      const hibernateAfter = new Date(
        Date.now() + SANDBOX_INACTIVITY_TIMEOUT_MS,
      );
      await this.prisma.sandbox.update({
        where: { id: sandboxId },
        data: {
          lifecycleState: 'active',
          lastActivityAt: new Date(),
          hibernateAfter,
          lifecycleError: null,
        },
      });
      this.emit(sandboxId, 'active');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to resume sandbox ${sandboxId}: ${message}`);
      await this.prisma.sandbox.update({
        where: { id: sandboxId },
        data: { lifecycleState: 'failed', lifecycleError: message },
      });
      this.emit(sandboxId, 'failed', message);
    }
  }

  async refreshActivity(sandboxId: number): Promise<void> {
    const hibernateAfter = new Date(Date.now() + SANDBOX_INACTIVITY_TIMEOUT_MS);
    await this.prisma.sandbox.updateMany({
      where: { id: sandboxId, lifecycleState: 'active' },
      data: { lastActivityAt: new Date(), hibernateAfter },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async runAutoHibernation(): Promise<void> {
    const due = await this.prisma.sandbox.findMany({
      where: {
        lifecycleState: 'active',
        hibernateAfter: { lte: new Date() },
      },
    });

    for (const sandbox of due) {
      await this.hibernate(sandbox.id).catch((err) => {
        this.logger.error(
          `Auto-hibernate failed for sandbox ${sandbox.id}: ${err}`,
        );
      });
    }
  }

  private emit(
    sandboxId: number,
    state: string,
    error?: string | null,
  ): void {
    const payload: SandboxLifecyclePayload = {
      sandboxId,
      lifecycleState: state,
      lifecycleError: error ?? null,
    };
    this.events.emit(`${SANDBOX_LIFECYCLE_EVENT}.${sandboxId}`, payload);
  }
}
