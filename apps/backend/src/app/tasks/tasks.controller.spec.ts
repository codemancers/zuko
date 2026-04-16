import { describe, it, expect, beforeEach, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TaskService, TaskStatus } from '@zuko/sales';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { OrganizationGuard } from '../../common/auth/organization.guard';

const ORG_ID = 1;

const mockReq = {
  user: { id: '1', name: 'Alice', email: 'alice@example.com' },
} as any;

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

describe('TasksController', () => {
  let controller: TasksController;

  const mockTaskService = {
    createTask: vi.fn(),
    getTasks: vi.fn(),
    getTaskById: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TaskService, useValue: mockTaskService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TasksController>(TasksController);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call createTask with orgId, dto and actorId', async () => {
      (mockTaskService.createTask as Mock).mockResolvedValue(
        mockTask as never,
      );

      const dto = { title: 'Test task' };
      const result = await controller.create(ORG_ID, dto, mockReq);

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        ORG_ID,
        expect.objectContaining({
          ...dto,
          createdByUserId: 1,
        }),
        1,
      );
      expect(result).toEqual(mockTask);
    });

    it('should pass optional fields through', async () => {
      const dto = {
        title: 'Sub task',
        parentId: 5,
        assignee: 'Alice',
        status: TaskStatus.IN_PROGRESS,
      };
      (mockTaskService.createTask as Mock).mockResolvedValue({
        ...mockTask,
        ...dto,
      } as never);

      await controller.create(ORG_ID, dto, mockReq);

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        ORG_ID,
        expect.objectContaining({
          ...dto,
          createdByUserId: 1,
        }),
        1,
      );
    });
  });

  describe('list', () => {
    it('should return paginated tasks with defaults', async () => {
      const paginatedResult = {
        tasks: [mockTask],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      };
      (mockTaskService.getTasks as Mock).mockResolvedValue(
        paginatedResult as never,
      );

      const result = await controller.list(ORG_ID, {});

      expect(mockTaskService.getTasks).toHaveBeenCalledWith(ORG_ID, {
        page: 1,
        limit: 50,
        parentId: undefined,
      });
      expect(result).toEqual(paginatedResult);
    });

    it('should parse numeric parentId from query string', async () => {
      (mockTaskService.getTasks as Mock).mockResolvedValue({
        tasks: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      } as never);

      await controller.list(ORG_ID, { parentId: '3' });

      const [, options] = (mockTaskService.getTasks as Mock).mock
        .calls[0] as [number, { parentId?: number | null }];
      expect(options.parentId).toBe(3);
    });

    it('should pass null parentId when query is "null"', async () => {
      (mockTaskService.getTasks as Mock).mockResolvedValue({
        tasks: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      } as never);

      await controller.list(ORG_ID, { parentId: 'null' });

      const [, options] = (mockTaskService.getTasks as Mock).mock
        .calls[0] as [number, { parentId?: number | null }];
      expect(options.parentId).toBeNull();
    });

    it('should apply custom page and limit', async () => {
      (mockTaskService.getTasks as Mock).mockResolvedValue({
        tasks: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      } as never);

      await controller.list(ORG_ID, { page: 2, limit: 10 });

      const [, options] = (mockTaskService.getTasks as Mock).mock
        .calls[0] as [number, { page: number; limit: number }];
      expect(options.page).toBe(2);
      expect(options.limit).toBe(10);
    });
  });

  describe('findOne', () => {
    it('should return a task by id', async () => {
      (mockTaskService.getTaskById as Mock).mockResolvedValue(
        mockTask as never,
      );

      const result = await controller.findOne(ORG_ID, 1);

      expect(mockTaskService.getTaskById).toHaveBeenCalledWith(ORG_ID, 1);
      expect(result).toEqual(mockTask);
    });

    it('should propagate NotFoundException from service', async () => {
      (mockTaskService.getTaskById as Mock).mockRejectedValue(
        new NotFoundException('Task with ID 99 not found') as never,
      );

      await expect(controller.findOne(ORG_ID, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should call updateTask with correct args including actorId', async () => {
      const dto = { title: 'Updated', status: TaskStatus.IN_PROGRESS };
      const updated = { ...mockTask, ...dto };
      (mockTaskService.updateTask as Mock).mockResolvedValue(
        updated as never,
      );

      const result = await controller.update(ORG_ID, 1, dto, mockReq);

      expect(mockTaskService.updateTask).toHaveBeenCalledWith(ORG_ID, 1, dto, 1);
      expect(result).toEqual(updated);
    });

    it('should propagate NotFoundException for missing task', async () => {
      (mockTaskService.updateTask as Mock).mockRejectedValue(
        new NotFoundException('Task with ID 99 not found') as never,
      );

      await expect(
        controller.update(ORG_ID, 99, { title: 'x' }, mockReq),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should call deleteTask and return undefined', async () => {
      (mockTaskService.deleteTask as Mock).mockResolvedValue(
        undefined as never,
      );

      const result = await controller.remove(ORG_ID, 1);

      expect(mockTaskService.deleteTask).toHaveBeenCalledWith(ORG_ID, 1);
      expect(result).toBeUndefined();
    });

    it('should propagate NotFoundException for missing task', async () => {
      (mockTaskService.deleteTask as Mock).mockRejectedValue(
        new NotFoundException('Task with ID 99 not found') as never,
      );

      await expect(controller.remove(ORG_ID, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
