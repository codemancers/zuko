import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { Contact, Organization, User } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TaskRepository, TaskStatus } from './task.repository';
import { TaskService } from '../services/task.service';
import type { PrismaService } from '../modules/prisma.types';

// Exercises the real repository against a migrated database. Requires
// DATABASE_URL pointing at a disposable database with the task.due_date
// migration applied.
describe.skipIf(!process.env.DATABASE_URL)(
  'TaskRepository dueDate (database)',
  () => {
    let prisma: PrismaClient;
    let repo: TaskRepository;
    let service: TaskService;
    let org: Organization;
    let otherOrg: Organization;
    let member: User;
    let contact: Contact;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const originalTZ = process.env.TZ;

    // The calendar day Postgres actually stores, independent of any JS Date.
    const storedDay = async (taskId: number) => {
      const [row] = await prisma.$queryRaw<{ day: string | null }[]>`
        SELECT due_date::text AS day FROM "task" WHERE id = ${taskId}`;
      return row.day;
    };

    beforeAll(async () => {
      prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
      });
      await prisma.$connect();
      repo = new TaskRepository(prisma as unknown as PrismaService);
      service = new TaskService(repo, {
        emitAsync: async () => [],
      } as unknown as EventEmitter2);

      const mkOrg = (key: string) =>
        prisma.organization.create({
          data: {
            name: `Due Date ${key} ${suffix}`,
            slug: `due-date-${key}-${suffix}`,
            createdAt: new Date(),
          },
        });
      org = await mkOrg('org');
      otherOrg = await mkOrg('other');
      member = await prisma.user.create({
        data: {
          name: `Due Member ${suffix}`,
          email: `due-${suffix}@example.com`,
        },
      });
      await prisma.member.create({
        data: {
          organizationId: org.id,
          userId: member.id,
          createdAt: new Date(),
        },
      });
      contact = await prisma.contact.create({
        data: { organizationId: org.id, name: `Due Contact ${suffix}` },
      });
    });

    afterEach(() => {
      if (originalTZ === undefined) delete process.env.TZ;
      else process.env.TZ = originalTZ;
    });

    afterAll(async () => {
      if (!prisma) return;
      try {
        const orgIds = [org?.id, otherOrg?.id].filter(Boolean) as number[];
        await prisma.task.deleteMany({
          where: { organizationId: { in: orgIds }, parentId: { not: null } },
        });
        await prisma.task.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
        if (member) await prisma.user.delete({ where: { id: member.id } });
      } finally {
        await prisma.$disconnect();
      }
    });

    it('migrates to a nullable DATE column without a default, plus an index', async () => {
      const columns = await prisma.$queryRaw<
        { data_type: string; is_nullable: string; column_default: unknown }[]
      >`SELECT data_type, is_nullable, column_default
          FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'task'
           AND column_name = 'due_date'`;
      expect(columns).toEqual([
        { data_type: 'date', is_nullable: 'YES', column_default: null },
      ]);
      const indexes = await prisma.$queryRaw<{ indexdef: string }[]>`
        SELECT indexdef FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = 'task'
           AND indexname = 'task_due_date_idx'`;
      expect(indexes).toHaveLength(1);
      expect(indexes[0].indexdef).toContain('(due_date)');
    });

    it('reads a row written without the column (pre-existing task) as null', async () => {
      const [{ id }] = await prisma.$queryRaw<{ id: number }[]>`
        INSERT INTO "task" (organization_id, title, updated_at)
        VALUES (${org.id}, ${'Legacy undated'}, now()) RETURNING id`;
      expect(await storedDay(id)).toBeNull();
      expect((await service.getTaskById(org.id, id)).dueDate).toBeNull();
      const { tasks } = await service.getTasks(org.id, {
        search: 'Legacy undated',
      });
      expect(tasks.find((t) => t.id === id)?.dueDate).toBeNull();
    });

    it('creates undated by default and with null', async () => {
      const omitted = await service.createTask(org.id, { title: 'Omitted' });
      const nulled = await service.createTask(org.id, {
        title: 'Nulled',
        dueDate: null,
      });
      expect(omitted.dueDate).toBeNull();
      expect(nulled.dueDate).toBeNull();
      expect(await storedDay(omitted.id)).toBeNull();
      expect(await storedDay(nulled.id)).toBeNull();
    });

    it('creates, reads, lists, returns subtasks, updates and clears as date-only', async () => {
      const parent = await service.createTask(
        org.id,
        {
          title: 'Dated parent',
          dueDate: '2026-11-03',
          createdByUserId: member.id,
        },
        member.id,
      );
      expect(parent.dueDate).toBe('2026-11-03');
      expect(await storedDay(parent.id)).toBe('2026-11-03');

      const child = await service.createTask(org.id, {
        title: 'Dated child',
        parentId: parent.id,
        dueDate: '2026-11-04',
      });
      expect(child.dueDate).toBe('2026-11-04');

      const detail = await service.getTaskById(org.id, parent.id);
      expect(detail.dueDate).toBe('2026-11-03');
      expect(detail.subtasks.map((s) => s.dueDate)).toEqual(['2026-11-04']);
      expect(JSON.parse(JSON.stringify(detail)).dueDate).toBe('2026-11-03');

      const { tasks } = await service.getTasks(org.id, {
        search: 'Dated parent',
      });
      const listed = tasks.find((t) => t.id === parent.id);
      expect(listed?.dueDate).toBe('2026-11-03');
      expect(listed?.subtasks[0].dueDate).toBe('2026-11-04');

      const { tasks: subtasks } = await service.getTasks(org.id, {
        parentId: parent.id,
      });
      expect(subtasks.map((t) => t.dueDate)).toEqual(['2026-11-04']);

      const moved = await service.updateTask(org.id, parent.id, {
        dueDate: '2026-12-31',
      });
      expect(moved.dueDate).toBe('2026-12-31');
      expect(moved.subtasks[0].dueDate).toBe('2026-11-04');
      expect(await storedDay(parent.id)).toBe('2026-12-31');

      const cleared = await service.updateTask(org.id, parent.id, {
        dueDate: null,
      });
      expect(cleared.dueDate).toBeNull();
      expect(await storedDay(parent.id)).toBeNull();
    });

    it('preserves the due date and other fields on an unrelated edit', async () => {
      const task = await service.createTask(
        org.id,
        {
          title: 'Unrelated edit',
          dueDate: '2026-11-03',
          isSales: true,
          assigneeUserId: member.id,
          contactId: contact.id,
          createdByUserId: member.id,
        },
        member.id,
      );
      const updated = await service.updateTask(org.id, task.id, {
        title: 'Unrelated edit renamed',
        status: TaskStatus.IN_PROGRESS,
      });
      expect(updated).toMatchObject({
        title: 'Unrelated edit renamed',
        status: TaskStatus.IN_PROGRESS,
        dueDate: '2026-11-03',
        isSales: true,
        assigneeUserId: member.id,
        contactId: contact.id,
        prospectId: null,
      });
      expect(updated.owners.map((o) => [o.userId, o.isPrimary])).toEqual([
        [member.id, true],
      ]);
      expect(await storedDay(task.id)).toBe('2026-11-03');

      // Setting the date leaves the other fields alone too.
      const redated = await service.updateTask(org.id, task.id, {
        dueDate: '2026-11-05',
      });
      expect(redated).toMatchObject({
        title: 'Unrelated edit renamed',
        isSales: true,
        assigneeUserId: member.id,
        contactId: contact.id,
        dueDate: '2026-11-05',
      });
    });

    it('rejects invalid due dates without writing anything', async () => {
      const task = await service.createTask(org.id, {
        title: 'Rollback',
        dueDate: '2026-11-03',
      });
      for (const dueDate of [
        '2026-02-29',
        '2026-11-03T00:00:00Z',
        '',
        20261103,
        new Date('2026-11-04T00:00:00Z'),
      ]) {
        await expect(
          service.updateTask(org.id, task.id, {
            title: 'Should not persist',
            dueDate: dueDate as never,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          service.createTask(org.id, {
            title: 'Rejected due create',
            dueDate: dueDate as never,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      // A valid date in a write that fails on another field is rolled back.
      await expect(
        service.updateTask(org.id, task.id, {
          dueDate: '2027-01-01',
          assigneeUserId: 2_000_000_000,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      const after = await service.getTaskById(org.id, task.id);
      expect(after.title).toBe('Rollback');
      expect(after.dueDate).toBe('2026-11-03');
      expect(
        await prisma.task.count({ where: { title: 'Rejected due create' } }),
      ).toBe(0);
    });

    it.each([
      ['Pacific/Kiritimati', -840],
      ['Asia/Kolkata', -330],
      ['UTC', 0],
      ['America/Los_Angeles', 480],
      ['Pacific/Pago_Pago', 660],
    ])(
      'keeps calendar-day boundaries and leap days exact with process TZ %s',
      async (tz, offset) => {
        process.env.TZ = tz;
        expect(new Date('2026-11-03T12:00:00Z').getTimezoneOffset()).toBe(
          offset,
        );
        for (const day of [
          '2026-01-01',
          '2026-12-31',
          '2024-02-29',
          '2000-02-29',
          '2026-03-01',
          '0001-01-01',
          '0050-06-15',
          '0099-12-31',
          '9999-12-31',
        ]) {
          const created = await repo.create({
            organizationId: org.id,
            title: `Boundary ${tz} ${day}`,
            dueDate: day,
          });
          expect(created.dueDate).toBe(day);
          expect(await storedDay(created.id)).toBe(day);
          expect((await repo.findById(created.id, org.id))?.dueDate).toBe(day);

          const cleared = await repo.update(created.id, org.id, {
            dueDate: null,
          });
          expect(cleared.dueDate).toBeNull();
          const reset = await repo.update(created.id, org.id, {
            dueDate: day,
          });
          expect(reset.dueDate).toBe(day);
          expect(await storedDay(created.id)).toBe(day);
        }
      },
    );

    it('scopes reads and writes to the organization', async () => {
      const task = await service.createTask(org.id, {
        title: 'Org scoped due',
        dueDate: '2026-11-03',
      });

      await expect(
        service.getTaskById(otherOrg.id, task.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.updateTask(otherOrg.id, task.id, { dueDate: null }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        repo.update(task.id, otherOrg.id, { dueDate: null }),
      ).rejects.toThrow();
      const { tasks } = await service.getTasks(otherOrg.id, {
        search: 'Org scoped due',
      });
      expect(tasks).toHaveLength(0);
      expect(await storedDay(task.id)).toBe('2026-11-03');
    });
  },
);
