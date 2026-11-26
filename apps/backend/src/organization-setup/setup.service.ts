import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  BeforeApplicationShutdown,
} from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { start } from 'workflow/api';
import { WORKFLOW_MODULE_OPTIONS } from '@workflow/nest';
import { PrismaService } from '../prisma/prisma.service';
import { provisionStandardObjects, StandardObjectConflict } from '../crm/provision-standard-objects';

@Injectable()
export class OrganizationSetupService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(OrganizationSetupService.name);
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private cycle?: Promise<void>;
  private backfill?: Promise<void>;
  private workflow?: { workflowId: string };

  constructor(
    private readonly prisma: PrismaService,
    @Inject(WORKFLOW_MODULE_OPTIONS) private readonly workflowOptions: { outDir: string },
  ) {}

  async onApplicationBootstrap() {
    const directory = this.workflowOptions.outDir;
    const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')) as {
      workflows: Record<string, Record<string, { workflowId: string }>>;
    };
    this.workflow = Object.values(manifest.workflows)
      .flatMap(Object.values)
      .find((entry) => entry.workflowId.endsWith('//organizationSetup'));
    if (!this.workflow)
      throw new Error('Organization setup workflow is missing; rebuild the backend');
    this.schedule(0);
    this.backfill = this.backfillStandardObjects().catch((error: unknown) =>
      this.logger.error('Standard object backfill failed', error),
    );
  }

  private schedule(delay: number) {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.cycle = this.reconcile()
        .catch((error: unknown) => this.logger.error(error))
        .finally(() => this.schedule(2000));
    }, delay);
    this.timer.unref();
  }

  async beforeApplicationShutdown() {
    // Finish dispatch before WorkflowModule closes the World.
    this.stopped = true;
    clearTimeout(this.timer);
    await this.cycle;
    await this.backfill;
  }

  /**
   * Bring organizations that finished setup before a standard object or field existed up to date.
   * Setup only runs once per organization, so without this they would never get it. Repeat-safe:
   * it adds only what is missing and leaves anything the organization changed or removed alone.
   */
  private async backfillStandardObjects() {
    let cursor = 0n;
    let updated = 0;
    for (;;) {
      const organizations = await this.prisma.organization.findMany({
        where: { id: { gt: cursor }, setupRunId: { not: null } },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 100,
      });
      if (!organizations.length || this.stopped) break;
      for (const { id } of organizations) {
        try {
          const created = await this.prisma.withTenant({ organizationId: id }, async (tx) => {
            const setup = await tx.organizationSetup.findUnique({ where: { organizationId: id } });
            // One still being set up provisions everything itself.
            return setup?.status === 'ready' ? provisionStandardObjects(tx, id) : [];
          });
          if (created.length) {
            updated += 1;
            this.logger.log(`Added ${created.join(', ')} to organization ${id}`);
          }
        } catch (error) {
          // A custom object already using a standard key is the organization's to resolve.
          const log = error instanceof StandardObjectConflict ? 'warn' : 'error';
          this.logger[log](`Standard objects not updated for organization ${id}`, error);
        }
      }
      cursor = organizations[organizations.length - 1].id;
    }
    if (updated) this.logger.log(`Standard objects added to ${updated} organizations`);
  }

  /** Only auth-table IDs are discovered globally; all setup data uses tenant transactions. */
  private async reconcile() {
    let cursor = 0n;
    for (;;) {
      const organizations = await this.prisma.organization.findMany({
        where: { id: { gt: cursor }, setupRunId: null },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 100,
      });
      if (!organizations.length || this.stopped) return;
      for (const { id } of organizations) {
        try {
          await this.attach(id);
        } catch (error) {
          this.logger.error(`Setup dispatch failed for organization ${id}`, error);
        }
      }
      cursor = organizations[organizations.length - 1].id;
    }
  }

  /** Also repairs a crash between Better Auth creating an org and its after-create hook. */
  async attach(organizationId: bigint) {
    if (!this.workflow) return; // Bootstrap's reconciliation will pick it up.
    // Commit the request before starting a run: a worker must be able to see it.
    await this.prisma.withTenant({ organizationId }, (tx) =>
      tx.organizationSetup.upsert({
        where: { organizationId },
        create: { organizationId },
        update: {},
      }),
    );
    const runId = await this.prisma.withTenant({ organizationId }, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`org-setup:${organizationId}`}))`;
      const setup = await tx.organizationSetup.findUniqueOrThrow({ where: { organizationId } });
      if (setup.runId) return setup.runId;
      let runId: string;
      try {
        const run = await start(this.workflow!, [String(organizationId)], {
          // Atomic SDK admission prevents a second run if dispatch commits but our DB write doesn't.
          attributes: { organizationId: String(organizationId) },
          experimental_hook: {
            token: `org-setup:${organizationId}:${setup.attempt}`,
            experimental_minRetention: '30d',
          },
        });
        runId = run.runId;
      } catch (error) {
        const existing = (error as { conflictingRunId?: unknown }).conflictingRunId;
        if (typeof existing !== 'string') throw error;
        runId = existing;
      }
      await tx.organizationSetup.update({ where: { organizationId }, data: { runId } });
      return runId;
    });
    // Better Auth exposes this server-owned reference through its existing organization API.
    await this.prisma.organization.updateMany({
      where: { id: organizationId, setupRunId: null },
      data: { setupRunId: runId },
    });
  }
}
