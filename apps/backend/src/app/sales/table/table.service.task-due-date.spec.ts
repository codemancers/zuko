import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Organization } from '@prisma/client';
import type {
  CompaniesService,
  ContactsService,
  DealsService,
  TableColumnRepository,
} from '@zuko/sales';
import { TableService } from './table.service';
import { TableRowBuilder } from './row-builder/table-row.builder';
import { PrismaService } from '../../../prisma/prisma.service';

// The tasks table reads and writes Prisma directly, bypassing TaskRepository,
// so it needs its own check that dueDate stays date-only. Requires
// DATABASE_URL pointing at a disposable database with the task.due_date
// migration applied.
describe.skipIf(!process.env.DATABASE_URL)(
  'TableService task dueDate (database)',
  () => {
    let prisma: PrismaService;
    let service: TableService;
    let org: Organization;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    beforeAll(async () => {
      prisma = new PrismaService();
      await prisma.$connect();
      service = new TableService(
        undefined as unknown as CompaniesService,
        undefined as unknown as ContactsService,
        undefined as unknown as DealsService,
        new TableRowBuilder(),
        undefined as unknown as TableColumnRepository,
        prisma,
      );
      org = await prisma.organization.create({
        data: {
          name: `Table Due ${suffix}`,
          slug: `table-due-${suffix}`,
          createdAt: new Date(),
        },
      });
    });

    afterAll(async () => {
      if (!prisma) return;
      try {
        if (org) {
          await prisma.task.deleteMany({ where: { organizationId: org.id } });
          await prisma.organization.delete({ where: { id: org.id } });
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    it('lists task rows with dueDate as YYYY-MM-DD or null', async () => {
      const dated = await prisma.task.create({
        data: {
          organizationId: org.id,
          title: 'Table dated',
          dueDate: new Date('2024-02-29T00:00:00.000Z'),
        },
      });
      const undated = await prisma.task.create({
        data: { organizationId: org.id, title: 'Table undated' },
      });

      const { data } = await service.getTasksTable(org.id);
      const rows = JSON.parse(JSON.stringify(data)) as {
        id: number;
        dueDate: string | null;
      }[];
      expect(rows.find((r) => r.id === dated.id)?.dueDate).toBe('2024-02-29');
      expect(rows.find((r) => r.id === undated.id)?.dueDate).toBeNull();
    });

    it('returns dueDate date-only from a task cell edit and leaves it unchanged', async () => {
      const task = await prisma.task.create({
        data: {
          organizationId: org.id,
          title: 'Cell edit',
          dueDate: new Date('2026-11-03T00:00:00.000Z'),
        },
      });
      const result = (await service.updateCell('tasks', task.id, org.id, 1, {
        columnId: 'title',
        value: 'Cell edited',
      })) as { dueDate: unknown };
      expect(JSON.parse(JSON.stringify(result)).dueDate).toBe('2026-11-03');

      const stored = await prisma.task.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(stored.dueDate?.toISOString()).toBe('2026-11-03T00:00:00.000Z');
    });

    it('does not expose dueDate as an editable task cell', async () => {
      const task = await prisma.task.create({
        data: { organizationId: org.id, title: 'No due cell' },
      });
      await expect(
        service.updateCell('tasks', task.id, org.id, 1, {
          columnId: 'dueDate',
          value: '2026-11-03',
        }),
      ).rejects.toThrow('Column not found');
    });
  },
);
