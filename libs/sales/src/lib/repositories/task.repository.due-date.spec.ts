import { describe, it, expect, beforeEach, type Mock } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { TaskRepository, TaskStatus } from './task.repository';
import type { PrismaService } from '../modules/prisma.types';

const ORG_ID = 1;
const DUE = new Date('2026-11-03T00:00:00.000Z');

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  organizationId: ORG_ID,
  title: 'Task',
  status: TaskStatus.TODO,
  completedAt: null,
  dueDate: DUE,
  parentId: null,
  subtasks: [{ id: 2, parentId: 1, dueDate: new Date('2024-02-29') }],
  ...overrides,
});

describe('TaskRepository dueDate', () => {
  let repo: TaskRepository;
  const mockPrisma = {
    task: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    taskOwner: { create: vi.fn() },
    member: { findFirst: vi.fn() },
    contact: { findFirst: vi.fn() },
    prospect: { findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(mockPrisma),
    ),
  };
  const dataOf = (mock: Mock) => mock.mock.calls[0][0].data;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new TaskRepository(mockPrisma as unknown as PrismaService);
    mockPrisma.task.create.mockResolvedValue(row());
    mockPrisma.task.update.mockResolvedValue(row());
    mockPrisma.task.findFirst.mockResolvedValue(row());
    mockPrisma.task.findUniqueOrThrow.mockResolvedValue(row());
  });

  describe('writes', () => {
    it('maps a date-only string to a UTC-midnight Date on create', async () => {
      await repo.create({
        organizationId: ORG_ID,
        title: 'Due',
        dueDate: '2026-11-03',
      });
      const { dueDate } = dataOf(mockPrisma.task.create);
      expect(dueDate).toBeInstanceOf(Date);
      expect(dueDate.toISOString()).toBe('2026-11-03T00:00:00.000Z');
    });

    it('omits the column on create when dueDate is omitted and writes null when null', async () => {
      await repo.create({ organizationId: ORG_ID, title: 'Undated' });
      expect(dataOf(mockPrisma.task.create)).not.toHaveProperty('dueDate');

      mockPrisma.task.create.mockClear();
      await repo.create({ organizationId: ORG_ID, title: 'N', dueDate: null });
      expect(dataOf(mockPrisma.task.create).dueDate).toBeNull();
    });

    it('preserves on omitted update, clears on null, sets on string', async () => {
      await repo.update(1, ORG_ID, { title: 'Renamed' });
      expect(dataOf(mockPrisma.task.update)).toEqual({ title: 'Renamed' });

      mockPrisma.task.update.mockClear();
      await repo.update(1, ORG_ID, { dueDate: null });
      expect(dataOf(mockPrisma.task.update)).toEqual({ dueDate: null });

      mockPrisma.task.update.mockClear();
      await repo.update(1, ORG_ID, { dueDate: '0050-06-15' });
      expect(dataOf(mockPrisma.task.update).dueDate.toISOString()).toBe(
        '0050-06-15T00:00:00.000Z',
      );
    });

    it.each(
      [
        '',
        '2026-02-29',
        '2026-11-03T00:00:00Z',
        '2026-11-03T00:00:00+05:30',
        20261103,
        true,
        [],
        {},
        new Date('2026-11-03T00:00:00Z'),
      ].map((value) => ({ value })),
    )(
      'rejects $value from non-HTTP callers before any write',
      async ({ value: dueDate }) => {
        await expect(
          repo.create({
            organizationId: ORG_ID,
            title: 'Bad',
            dueDate: dueDate as never,
          }),
        ).rejects.toThrow(BadRequestException);
        await expect(
          repo.update(1, ORG_ID, { title: 'Bad', dueDate: dueDate as never }),
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        expect(mockPrisma.task.create).not.toHaveBeenCalled();
        expect(mockPrisma.task.update).not.toHaveBeenCalled();
      },
    );
  });

  describe('reads', () => {
    const expectDateOnly = (task: {
      dueDate: unknown;
      subtasks: { dueDate: unknown }[];
    }) => {
      expect(task.dueDate).toBe('2026-11-03');
      expect(task.subtasks[0].dueDate).toBe('2024-02-29');
    };

    it('serializes create (with and without owner), update and detail', async () => {
      expectDateOnly(await repo.create({ organizationId: ORG_ID, title: 'x' }));
      expectDateOnly(
        await repo.create({
          organizationId: ORG_ID,
          title: 'x',
          createdByUserId: 5,
        }),
      );
      expectDateOnly(await repo.update(1, ORG_ID, { title: 'y' }));
      expectDateOnly((await repo.findById(1, ORG_ID))!);
    });

    it('serializes list rows and keeps null', async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        row(),
        row({ id: 3, dueDate: null, subtasks: [] }),
      ]);
      mockPrisma.task.count.mockResolvedValue(2);
      const { tasks } = await repo.findAll(ORG_ID);
      expectDateOnly(tasks[0]);
      expect(tasks[1].dueDate).toBeNull();
    });

    it('returns null for a missing task', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);
      expect(await repo.findById(9, ORG_ID)).toBeNull();
    });
  });
});
