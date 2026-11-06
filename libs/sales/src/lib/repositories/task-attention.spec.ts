import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../modules/prisma.types';
import { TaskRepository } from './task.repository';

describe('Needs attention task query', () => {
  const task = { findMany: vi.fn(), count: vi.fn() };
  const repo = new TaskRepository({ task } as unknown as PrismaService);
  beforeEach(() => {
    vi.clearAllMocks();
    task.findMany.mockResolvedValue([
      { id: 8, dueDate: new Date('2026-11-05T00:00:00Z') },
    ]);
    task.count.mockResolvedValue(1);
  });
  it.each([undefined, null, '', '2026-02-30', '2026-11-05T00:00:00Z'])(
    'rejects invalid or missing date %s before querying',
    async (date) => {
      await expect(
        repo.findNeedsAttention(7, { date: date as string }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(task.findMany).not.toHaveBeenCalled();
    },
  );
  it.each([
    { page: 0 },
    { page: -1 },
    { page: 1.5 },
    { page: 1000001 },
    { limit: 0 },
    { limit: 101 },
    { limit: NaN },
  ])('rejects invalid pagination %j', async (pagination) => {
    await expect(
      repo.findNeedsAttention(7, { date: '2026-11-05', ...pagination }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(task.findMany).not.toHaveBeenCalled();
  });
  it('paginates deterministically and reports an empty page without inventing a result', async () => {
    task.findMany.mockResolvedValue([]);
    task.count.mockResolvedValue(4);
    const result = await repo.findNeedsAttention(7, {
      date: '2026-11-05',
      page: 3,
      limit: 2,
    });
    expect(task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 4, take: 2 }),
    );
    expect(result).toEqual({
      tasks: [],
      pagination: { page: 3, limit: 2, total: 4, totalPages: 2 },
    });
  });
  it.each(['Pacific/Kiritimati', 'America/New_York', 'UTC'])(
    'does not shift the calendar cutoff with server timezone %s (DST date)',
    async (zone) => {
      const previous = process.env.TZ;
      try {
        process.env.TZ = zone;
        await repo.findNeedsAttention(7, { date: '2026-11-01' });
        expect(
          task.findMany.mock.calls[0][0].where.dueDate.lte.toISOString(),
        ).toBe('2026-11-01T00:00:00.000Z');
      } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
      }
    },
  );
  it('uses current-org stable assignee membership, open sales tasks and an inclusive date-only cutoff', async () => {
    const result = await repo.findNeedsAttention(7, { date: '2026-11-05' });
    const where = {
      organizationId: 7,
      isSales: true,
      status: { in: ['TODO', 'IN_PROGRESS'] },
      dueDate: { not: null, lte: new Date('2026-11-05T00:00:00Z') },
      assigneeUser: {
        is: {
          members: {
            some: { organizationId: 7, role: { in: ['owner', 'admin'] } },
          },
        },
      },
    };
    expect(task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        skip: 0,
        take: 50,
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(task.count).toHaveBeenCalledWith({ where });
    expect(result).toEqual({
      tasks: [{ id: 8, dueDate: '2026-11-05' }],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
  });
});
