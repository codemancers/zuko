import { describe, it, expect, beforeEach, type Mock } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { TaskRepository, TaskStatus } from './task.repository';
import type { PrismaService } from '../modules/prisma.types';

const ORG_ID = 1;

const mockTask = {
  id: 1,
  organizationId: ORG_ID,
  title: 'Test task',
  description: null,
  status: TaskStatus.TODO,
  completedAt: null,
  parentId: null,
  assignee: null,
  subtasks: [],
  createdAt: new Date('2026-03-12'),
  updatedAt: new Date('2026-03-12'),
};

describe('TaskRepository', () => {
  let repo: TaskRepository;

  const mockPrisma = {
    task: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    taskOwner: {
      create: vi.fn(),
    },
    member: {
      findFirst: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
    },
    prospect: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
        fn({
          task: mockPrisma.task,
          taskOwner: mockPrisma.taskOwner,
          member: mockPrisma.member,
          contact: mockPrisma.contact,
          prospect: mockPrisma.prospect,
        } as never),
    ),
  };

  beforeEach(() => {
    repo = new TaskRepository(mockPrisma as unknown as PrismaService);
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a task and include subtasks', async () => {
      (mockPrisma.task.create as Mock).mockResolvedValue(mockTask as never);

      const result = await repo.create({
        organizationId: ORG_ID,
        title: 'Test task',
      });

      expect(mockPrisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { title: 'Test task', organizationId: ORG_ID },
          include: expect.objectContaining({ subtasks: true }),
        }),
      );
      expect(result).toEqual(mockTask);
    });
  });

  describe('findById', () => {
    it('should find a task by id scoped to org', async () => {
      (mockPrisma.task.findFirst as Mock).mockResolvedValue(mockTask as never);

      const result = await repo.findById(1, ORG_ID);

      expect(mockPrisma.task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, organizationId: ORG_ID },
          include: expect.objectContaining({ subtasks: true }),
        }),
      );
      expect(result).toEqual(mockTask);
    });

    it('should return null when not found', async () => {
      (mockPrisma.task.findFirst as Mock).mockResolvedValue(null as never);

      const result = await repo.findById(99, ORG_ID);

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should default to top-level tasks (parentId: null)', async () => {
      (mockPrisma.task.findMany as Mock).mockResolvedValue([mockTask] as never);
      (mockPrisma.task.count as Mock).mockResolvedValue(1 as never);

      const result = await repo.findAll(ORG_ID);

      const findManyCall = (mockPrisma.task.findMany as Mock).mock
        .calls[0][0] as { where: object };
      expect(findManyCall.where).toEqual({
        organizationId: ORG_ID,
        parentId: null,
      });
      expect(result.tasks).toEqual([mockTask]);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by parentId when provided', async () => {
      (mockPrisma.task.findMany as Mock).mockResolvedValue([] as never);
      (mockPrisma.task.count as Mock).mockResolvedValue(0 as never);

      await repo.findAll(ORG_ID, { parentId: 5 });

      const findManyCall = (mockPrisma.task.findMany as Mock).mock
        .calls[0][0] as { where: object };
      expect(findManyCall.where).toEqual({
        organizationId: ORG_ID,
        parentId: 5,
      });
    });

    it('should apply pagination correctly', async () => {
      (mockPrisma.task.findMany as Mock).mockResolvedValue([] as never);
      (mockPrisma.task.count as Mock).mockResolvedValue(25 as never);

      const result = await repo.findAll(ORG_ID, { page: 3, limit: 10 });

      const findManyCall = (mockPrisma.task.findMany as Mock).mock
        .calls[0][0] as { skip: number; take: number };
      expect(findManyCall.skip).toBe(20);
      expect(findManyCall.take).toBe(10);
      expect(result.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });
  });

  describe('update', () => {
    it('should update a task by id', async () => {
      const updated = { ...mockTask, title: 'Updated' };
      (mockPrisma.task.update as Mock).mockResolvedValue(updated as never);

      const result = await repo.update(1, ORG_ID, { title: 'Updated' });

      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, organizationId: ORG_ID },
          data: { title: 'Updated' },
          include: expect.objectContaining({ subtasks: true }),
        }),
      );
      expect(result).toEqual(updated);
    });
  });

  describe('assignee', () => {
    const memberRow = { user: { id: 42, name: 'Server Name' } };

    it('create resolves the stable assignee name in the same transaction and keeps the creator owner link', async () => {
      (mockPrisma.member.findFirst as Mock).mockResolvedValue(memberRow);
      (mockPrisma.task.create as Mock).mockResolvedValue({
        ...mockTask,
        id: 9,
      });
      (mockPrisma.task.findUniqueOrThrow as Mock).mockResolvedValue(mockTask);

      await repo.create({
        organizationId: ORG_ID,
        title: 'Assigned',
        assignee: 'Caller Supplied Name',
        assigneeUserId: 42,
        createdByUserId: 7,
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.member.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: ORG_ID, userId: 42 },
        }),
      );
      expect(mockPrisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            title: 'Assigned',
            organizationId: ORG_ID,
            assigneeUserId: 42,
            assignee: 'Server Name',
          },
        }),
      );
      expect(mockPrisma.taskOwner.create).toHaveBeenCalledWith({
        data: { taskId: 9, userId: 7, isPrimary: true },
      });
    });

    it('create rejects an assignee outside the organization without writing', async () => {
      (mockPrisma.member.findFirst as Mock).mockResolvedValue(null);

      await expect(
        repo.create({ organizationId: ORG_ID, title: 'x', assigneeUserId: 99 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.task.create).not.toHaveBeenCalled();
      expect(mockPrisma.taskOwner.create).not.toHaveBeenCalled();
    });

    it('update writes stable ID and server-resolved name atomically', async () => {
      (mockPrisma.member.findFirst as Mock).mockResolvedValue(memberRow);
      (mockPrisma.task.update as Mock).mockResolvedValue(mockTask);

      await repo.update(1, ORG_ID, {
        assigneeUserId: 42,
        assignee: 'Spoofed',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, organizationId: ORG_ID },
          data: { assigneeUserId: 42, assignee: 'Server Name' },
        }),
      );
    });

    it('update rejects a foreign-org assignee without writing', async () => {
      (mockPrisma.member.findFirst as Mock).mockResolvedValue(null);

      await expect(
        repo.update(1, ORG_ID, { assigneeUserId: 99 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });

    it('update with explicit null clears stable ID and legacy name', async () => {
      (mockPrisma.task.update as Mock).mockResolvedValue(mockTask);

      await repo.update(1, ORG_ID, { assigneeUserId: null });

      expect(mockPrisma.member.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { assigneeUserId: null, assignee: null },
        }),
      );
    });

    it('legacy assignee-only update clears the stable ID instead of inferring one', async () => {
      (mockPrisma.task.update as Mock).mockResolvedValue(mockTask);

      await repo.update(1, ORG_ID, { assignee: 'Unique Member Name' });

      expect(mockPrisma.member.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { assignee: 'Unique Member Name', assigneeUserId: null },
        }),
      );
    });

    it('omitting both assignment fields leaves them untouched', async () => {
      (mockPrisma.task.update as Mock).mockResolvedValue(mockTask);

      await repo.update(1, ORG_ID, { title: 'Only title' });

      const data = (mockPrisma.task.update as Mock).mock.calls[0][0].data;
      expect(data).toEqual({ title: 'Only title' });
    });

    it('includes the related assignee user for display', async () => {
      (mockPrisma.task.findFirst as Mock).mockResolvedValue(mockTask);

      await repo.findById(1, ORG_ID);

      expect(mockPrisma.task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            assigneeUser: {
              select: { id: true, name: true, email: true },
            },
          }),
        }),
      );
    });
  });

  describe('person reference', () => {
    const dataOf = (mock: Mock) => mock.mock.calls[0][0].data;

    it('create links an org-scoped contact in the same transaction', async () => {
      (mockPrisma.contact.findFirst as Mock).mockResolvedValue({ id: 5 });
      (mockPrisma.task.create as Mock).mockResolvedValue(mockTask);

      await repo.create({ organizationId: ORG_ID, title: 'x', contactId: 5 });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.contact.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 5, organizationId: ORG_ID } }),
      );
      expect(dataOf(mockPrisma.task.create as Mock)).toEqual({
        title: 'x',
        organizationId: ORG_ID,
        contactId: 5,
        prospectId: null,
      });
    });

    it('create links an org-scoped prospect without touching contacts', async () => {
      (mockPrisma.prospect.findFirst as Mock).mockResolvedValue({ id: 8 });
      (mockPrisma.task.create as Mock).mockResolvedValue(mockTask);

      await repo.create({ organizationId: ORG_ID, title: 'x', prospectId: 8 });

      expect(mockPrisma.prospect.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 8, organizationId: ORG_ID } }),
      );
      expect(mockPrisma.contact.findFirst).not.toHaveBeenCalled();
      expect(dataOf(mockPrisma.task.create as Mock)).toEqual({
        title: 'x',
        organizationId: ORG_ID,
        prospectId: 8,
        contactId: null,
      });
    });

    it('create without references writes no reference columns', async () => {
      (mockPrisma.task.create as Mock).mockResolvedValue(mockTask);

      await repo.create({ organizationId: ORG_ID, title: 'x' });

      expect(mockPrisma.contact.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.prospect.findFirst).not.toHaveBeenCalled();
      expect(dataOf(mockPrisma.task.create as Mock)).toEqual({
        title: 'x',
        organizationId: ORG_ID,
      });
    });

    it.each([
      ['contact', { contactId: 99 }],
      ['prospect', { prospectId: 99 }],
    ] as const)(
      'rejects a %s outside the organization without writing',
      async (model, refs) => {
        (mockPrisma[model].findFirst as Mock).mockResolvedValue(null);

        await expect(
          repo.create({ organizationId: ORG_ID, title: 'x', ...refs }),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          repo.update(1, ORG_ID, { title: 'x', ...refs }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(mockPrisma.task.create).not.toHaveBeenCalled();
        expect(mockPrisma.task.update).not.toHaveBeenCalled();
        expect(mockPrisma.taskOwner.create).not.toHaveBeenCalled();
      },
    );

    it('rejects both references at once without lookups or writes', async () => {
      await expect(
        repo.create({
          organizationId: ORG_ID,
          title: 'x',
          contactId: 5,
          prospectId: 8,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        repo.update(1, ORG_ID, { contactId: 5, prospectId: 8 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.contact.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.prospect.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.task.create).not.toHaveBeenCalled();
      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });

    it('update setting a contact clears any prior prospect', async () => {
      (mockPrisma.contact.findFirst as Mock).mockResolvedValue({ id: 5 });
      (mockPrisma.task.update as Mock).mockResolvedValue(mockTask);

      await repo.update(1, ORG_ID, { contactId: 5 });

      expect(dataOf(mockPrisma.task.update as Mock)).toEqual({
        contactId: 5,
        prospectId: null,
      });
    });

    it('update setting a prospect clears any prior contact', async () => {
      (mockPrisma.prospect.findFirst as Mock).mockResolvedValue({ id: 8 });
      (mockPrisma.task.update as Mock).mockResolvedValue(mockTask);

      await repo.update(1, ORG_ID, { prospectId: 8, contactId: null });

      expect(dataOf(mockPrisma.task.update as Mock)).toEqual({
        prospectId: 8,
        contactId: null,
      });
    });

    it.each([
      [{ contactId: null }, { contactId: null }],
      [{ prospectId: null }, { prospectId: null }],
      [
        { contactId: null, prospectId: null },
        { contactId: null, prospectId: null },
      ],
    ])('update %j clears only what was sent', async (input, expected) => {
      (mockPrisma.task.update as Mock).mockResolvedValue(mockTask);

      await repo.update(1, ORG_ID, input);

      expect(mockPrisma.contact.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.prospect.findFirst).not.toHaveBeenCalled();
      expect(dataOf(mockPrisma.task.update as Mock)).toEqual(expected);
    });

    it('includes only id and name of the linked person', async () => {
      (mockPrisma.task.findFirst as Mock).mockResolvedValue(mockTask);

      await repo.findById(1, ORG_ID);

      expect(mockPrisma.task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            contact: { select: { id: true, name: true } },
            prospect: { select: { id: true, name: true } },
          }),
        }),
      );
    });

    it('ignores caller-supplied relation operations and org changes', async () => {
      (mockPrisma.task.create as Mock).mockResolvedValue(mockTask);
      (mockPrisma.task.update as Mock).mockResolvedValue(mockTask);
      const injected = {
        contact: { connect: { id: 99 } },
        prospect: { create: { name: 'Injected', organizationId: 2 } },
        owners: { create: [{ userId: 99 }] },
        organization: { connect: { id: 2 } },
        assigneeUser: { connect: { id: 99 } },
      };

      await repo.create({
        organizationId: ORG_ID,
        title: 'x',
        ...injected,
      } as never);
      await repo.update(1, ORG_ID, {
        title: 'y',
        organizationId: 2,
        ...injected,
      } as never);

      expect(dataOf(mockPrisma.task.create as Mock)).toEqual({
        title: 'x',
        organizationId: ORG_ID,
      });
      expect(dataOf(mockPrisma.task.update as Mock)).toEqual({ title: 'y' });
    });
  });

  describe('delete', () => {
    it('should delete a task by id', async () => {
      (mockPrisma.task.delete as Mock).mockResolvedValue(mockTask as never);

      await repo.delete(1, ORG_ID);

      expect(mockPrisma.task.delete).toHaveBeenCalledWith({
        where: { id: 1, organizationId: ORG_ID },
      });
    });
  });

  describe('updateSubtasksCompletedAt', () => {
    it('should bulk-update all subtasks of a parent', async () => {
      (mockPrisma.task.updateMany as Mock).mockResolvedValue({
        count: 2,
      } as never);

      const completedAt = new Date('2026-03-12');
      await repo.updateSubtasksCompletedAt(1, completedAt);

      expect(mockPrisma.task.updateMany).toHaveBeenCalledWith({
        where: { parentId: 1 },
        data: { completedAt, status: TaskStatus.DONE },
      });
    });
  });
});
