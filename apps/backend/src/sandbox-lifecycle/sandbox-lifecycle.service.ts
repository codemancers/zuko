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
  private readonly spritesEnabled = process.env.SPRITES_ENABLED !== 'false';

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

      if (this.spritesEnabled) {
        // Ignore errors — sprite may already be cold (Fly auto-suspended it)
        await this.sprites.stopSprite(sandbox.name).catch((err) => {
          this.logger.warn(
            `stopSprite for ${sandbox.name} failed (possibly already cold): ${err}`,
          );
        });
      }

      await this.prisma.sandbox.update({
        where: { id: sandboxId },
        data: { lifecycleState: 'hibernated', hibernateAfter: null },
      });
      this.emit(sandboxId, 'hibernated');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to hibernate sandbox ${sandboxId}: ${message}`);
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

      if (this.spritesEnabled) {
        // Swallow errors — sprite may already be starting/running (API can return
        // a non-2xx in that case). If startSprite truly failed the next command
        // will reveal it; we still mark active so the badge isn't stuck.
        await this.sprites.startSprite(sandbox.name).catch((err) => {
          this.logger.warn(
            `startSprite for ${sandbox.name} returned an error (may already be running): ${err}`,
          );
        });
      }

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

  /**
   * Check the actual Fly sprite status and reconcile DB state if out of sync.
   * Called fire-and-forget from the SSE connect handler so clients get the real
   * state shortly after opening the stream without blocking the response.
   *
   * Only acts when DB says "active" — if Fly reports "cold" we write "hibernated"
   * directly (no stopSprite call needed, the machine is already stopped).
   */
  async reconcileWithFly(sandboxId: number): Promise<void> {
    if (!this.spritesEnabled) return;
    const sandbox = await this.prisma.sandbox.findUnique({
      where: { id: sandboxId },
    });
    if (!sandbox || sandbox.lifecycleState !== 'active') return;

    try {
      const sprite = await this.sprites.getSprite(sandbox.name);
      const isWarm = sprite.status === 'running' || sprite.status === 'warm';
      if (!isWarm) {
        // Fly has auto-suspended the sprite — update DB without calling stopSprite
        await this.prisma.sandbox.update({
          where: { id: sandboxId },
          data: { lifecycleState: 'hibernated', hibernateAfter: null },
        });
        this.emit(sandboxId, 'hibernated');
      }
    } catch {
      // Ignore — reconciliation errors must not affect UX
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
    if (!this.spritesEnabled) return;
    const now = new Date();
    const due = await this.prisma.sandbox.findMany({
      where: {
        lifecycleState: 'active',
        OR: [
          { hibernateAfter: { lte: now } },
          // Treat NULL hibernateAfter as overdue (sandbox pre-dates lifecycle tracking)
          { hibernateAfter: null },
        ],
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

  private emit(sandboxId: number, state: string, error?: string | null): void {
    const payload: SandboxLifecyclePayload = {
      sandboxId,
      lifecycleState: state,
      lifecycleError: error ?? null,
    };
    this.events.emit(`${SANDBOX_LIFECYCLE_EVENT}.${sandboxId}`, payload);
  }
}
