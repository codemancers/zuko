import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { Organization, User } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TaskRepository } from './task.repository';
import { TaskService } from '../services/task.service';
import type { PrismaService } from '../modules/prisma.types';

// Exercises the real repository transactions against a migrated database.
// Requires DATABASE_URL pointing at a disposable database with the
// task.assignee_user_id migration applied.
describe.skipIf(!process.env.DATABASE_URL)(
  'TaskRepository assignee (database)',
  () => {
    let prisma: PrismaClient;
    let repo: TaskRepository;
    let service: TaskService;
    let org: Organization;
    let otherOrg: Organization;
    let creator: User;
    let dupA: User;
    let dupB: User;
    let outsider: User;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const ownerLinks = (taskId: number) =>
      prisma.taskOwner.findMany({
        where: { taskId },
        select: { userId: true, isPrimary: true },
        orderBy: { userId: 'asc' },
      });

    beforeAll(async () => {
      prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
      });
      await prisma.$connect();
      repo = new TaskRepository(prisma as unknown as PrismaService);
      service = new TaskService(repo, {
        emitAsync: async () => [],
      } as unknown as EventEmitter2);

      org = await prisma.organization.create({
        data: {
          name: `Assignee Org ${suffix}`,
          slug: `assignee-org-${suffix}`,
          createdAt: new Date(),
        },
      });
      otherOrg = await prisma.organization.create({
        data: {
          name: `Other Org ${suffix}`,
          slug: `other-org-${suffix}`,
          createdAt: new Date(),
        },
      });
      const mkUser = (key: string, name: string) =>
        prisma.user.create({
          data: { name, email: `${key}-${suffix}@example.com` },
        });
      creator = await mkUser('creator', `Creator ${suffix}`);
      dupA = await mkUser('dup-a', `Sam Dup ${suffix}`);
      dupB = await mkUser('dup-b', `Sam Dup ${suffix}`);
      outsider = await mkUser('outsider', `Outsider ${suffix}`);
      for (const user of [creator, dupA, dupB]) {
        await prisma.member.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            createdAt: new Date(),
          },
        });
      }
      await prisma.member.create({
        data: {
          organizationId: otherOrg.id,
          userId: outsider.id,
          createdAt: new Date(),
        },
      });
    });

    afterAll(async () => {
      if (!prisma) return;
      const orgIds = [org?.id, otherOrg?.id].filter(Boolean) as number[];
      await prisma.task.deleteMany({
        where: { organizationId: { in: orgIds }, parentId: { not: null } },
      });
      await prisma.task.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [creator, dupA, dupB, outsider]
              .filter(Boolean)
              .map((u) => u.id),
          },
        },
      });
      await prisma.$disconnect();
    });

    it('creates with a stable assignee, resolves the name server-side, and keeps the creator owner link', async () => {
      const task = await repo.create({
        organizationId: org.id,
        title: 'Create assigned',
        assignee: 'Caller Supplied',
        assigneeUserId: dupB.id,
        createdByUserId: creator.id,
      });

      expect(task.assigneeUserId).toBe(dupB.id);
      expect(task.assignee).toBe(dupB.name);
      expect(task.assigneeUser).toEqual({
        id: dupB.id,
        name: dupB.name,
        email: dupB.email,
      });
      expect(await ownerLinks(task.id)).toEqual([
        { userId: creator.id, isPrimary: true },
      ]);
    });

    it('distinguishes members with duplicate names by user ID, then reassigns and clears without touching owners', async () => {
      const task = await repo.create({
        organizationId: org.id,
        title: 'Duplicates',
        assigneeUserId: dupA.id,
        createdByUserId: creator.id,
      });
      expect(task.assigneeUserId).toBe(dupA.id);

      const reassigned = await repo.update(task.id, org.id, {
        assigneeUserId: dupB.id,
      });
      expect(reassigned.assigneeUserId).toBe(dupB.id);
      expect(reassigned.assigneeUser?.email).toBe(dupB.email);

      const cleared = await repo.update(task.id, org.id, {
        assigneeUserId: null,
      });
      expect(cleared.assigneeUserId).toBeNull();
      expect(cleared.assignee).toBeNull();
      expect(cleared.assigneeUser).toBeNull();

      expect(await ownerLinks(task.id)).toEqual([
        { userId: creator.id, isPrimary: true },
      ]);
    });

    it('rejects a user from another organization and leaves the task unchanged', async () => {
      const task = await repo.create({
        organizationId: org.id,
        title: 'Foreign',
        assigneeUserId: dupA.id,
        createdByUserId: creator.id,
      });

      await expect(
        service.updateTask(org.id, task.id, { assigneeUserId: outsider.id }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        repo.create({
          organizationId: org.id,
          title: 'Foreign create',
          assigneeUserId: outsider.id,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        repo.update(task.id, org.id, { assigneeUserId: 2_000_000_000 }),
      ).rejects.toBeInstanceOf(BadRequestException);

      const after = await repo.findById(task.id, org.id);
      expect(after?.assigneeUserId).toBe(dupA.id);
      expect(after?.assignee).toBe(dupA.name);
      expect(
        await prisma.task.count({
          where: { organizationId: org.id, title: 'Foreign create' },
        }),
      ).toBe(0);
    });

    it('displays the current related user name after a rename', async () => {
      const renamed = await prisma.user.create({
        data: {
          name: `Before ${suffix}`,
          email: `rename-${suffix}@example.com`,
        },
      });
      await prisma.member.create({
        data: {
          organizationId: org.id,
          userId: renamed.id,
          createdAt: new Date(),
        },
      });
      try {
        const task = await repo.create({
          organizationId: org.id,
          title: 'Rename',
          assigneeUserId: renamed.id,
        });
        await prisma.user.update({
          where: { id: renamed.id },
          data: { name: `After ${suffix}` },
        });

        const after = await repo.findById(task.id, org.id);
        expect(after?.assigneeUserId).toBe(renamed.id);
        expect(after?.assigneeUser?.name).toBe(`After ${suffix}`);
      } finally {
        await prisma.task.deleteMany({
          where: { organizationId: org.id, assigneeUserId: renamed.id },
        });
        await prisma.user.delete({ where: { id: renamed.id } });
      }
    });

    it('preserves an unresolved legacy name on unrelated edits and never infers an ID from a unique name', async () => {
      const legacy = await prisma.task.create({
        data: {
          organizationId: org.id,
          title: 'Legacy',
          assignee: creator.name,
        },
      });

      const edited = await service.updateTask(org.id, legacy.id, {
        title: 'Legacy renamed',
      });
      expect(edited.assignee).toBe(creator.name);
      expect(edited.assigneeUserId).toBeNull();

      const created = await repo.create({
        organizationId: org.id,
        title: 'Legacy create',
        assignee: creator.name,
      });
      expect(created.assignee).toBe(creator.name);
      expect(created.assigneeUserId).toBeNull();
    });

    it('clears the stable ID when the legacy name is explicitly rewritten', async () => {
      const task = await repo.create({
        organizationId: org.id,
        title: 'Legacy rewrite',
        assigneeUserId: dupA.id,
        createdByUserId: creator.id,
      });

      const rewritten = await repo.update(task.id, org.id, {
        assignee: 'Free Text',
      });
      expect(rewritten.assignee).toBe('Free Text');
      expect(rewritten.assigneeUserId).toBeNull();
      expect(await ownerLinks(task.id)).toEqual([
        { userId: creator.id, isPrimary: true },
      ]);
    });
  },
);
