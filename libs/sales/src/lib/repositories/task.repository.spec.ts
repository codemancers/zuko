import { describe, it, expect, beforeEach, type Mock } from 'vitest';
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
    $transaction: vi.fn(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
        fn({
          task: mockPrisma.task,
          taskOwner: mockPrisma.taskOwner,
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
          where: { id: 1 },
          data: { title: 'Updated' },
          include: expect.objectContaining({ subtasks: true }),
        }),
      );
      expect(result).toEqual(updated);
    });
  });

  describe('delete', () => {
    it('should delete a task by id', async () => {
      (mockPrisma.task.delete as Mock).mockResolvedValue(mockTask as never);

      await repo.delete(1, ORG_ID);

      expect(mockPrisma.task.delete).toHaveBeenCalledWith({
        where: { id: 1 },
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
