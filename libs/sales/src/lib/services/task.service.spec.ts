import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskRepository, TaskStatus } from '../repositories/task.repository';

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

describe('TaskService', () => {
  let service: TaskService;

  const mockRepo = {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateSubtasksCompletedAt: jest.fn(),
  };

  beforeEach(() => {
    service = new TaskService(mockRepo as unknown as TaskRepository);
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a task with orgId', async () => {
      (mockRepo.create as jest.Mock).mockResolvedValue(mockTask as never);

      const result = await service.createTask(ORG_ID, { title: 'Test task' });

      expect(mockRepo.create).toHaveBeenCalledWith({
        title: 'Test task',
        organizationId: ORG_ID,
      });
      expect(result).toEqual(mockTask);
    });

    it('should pass optional fields to repository', async () => {
      const input = {
        title: 'Subtask',
        parentId: 2,
        assignee: 'Bob',
        status: TaskStatus.IN_PROGRESS,
      };
      (mockRepo.create as jest.Mock).mockResolvedValue({
        ...mockTask,
        ...input,
      } as never);

      await service.createTask(ORG_ID, input);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...input,
        organizationId: ORG_ID,
      });
    });
  });

  describe('getTasks', () => {
    it('should return paginated tasks', async () => {
      const paginatedResult = {
        tasks: [mockTask],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      };
      (mockRepo.findAll as jest.Mock).mockResolvedValue(
        paginatedResult as never,
      );

      const result = await service.getTasks(ORG_ID, { page: 1, limit: 50 });

      expect(mockRepo.findAll).toHaveBeenCalledWith(ORG_ID, {
        page: 1,
        limit: 50,
      });
      expect(result).toEqual(paginatedResult);
    });

    it('should forward parentId filter', async () => {
      (mockRepo.findAll as jest.Mock).mockResolvedValue({
        tasks: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      } as never);

      await service.getTasks(ORG_ID, { parentId: 5 });

      expect(mockRepo.findAll).toHaveBeenCalledWith(ORG_ID, { parentId: 5 });
    });
  });

  describe('getTaskById', () => {
    it('should return task when found', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(mockTask as never);

      const result = await service.getTaskById(ORG_ID, 1);

      expect(mockRepo.findById).toHaveBeenCalledWith(1, ORG_ID);
      expect(result).toEqual(mockTask);
    });

    it('should throw NotFoundException when task not found', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(null as never);

      await expect(service.getTaskById(ORG_ID, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateTask', () => {
    it('should update a task', async () => {
      const updated = { ...mockTask, title: 'Updated' };
      (mockRepo.findById as jest.Mock).mockResolvedValue(mockTask as never);
      (mockRepo.update as jest.Mock).mockResolvedValue(updated as never);

      const result = await service.updateTask(ORG_ID, 1, { title: 'Updated' });

      expect(mockRepo.update).toHaveBeenCalledWith(1, ORG_ID, {
        title: 'Updated',
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when task does not exist', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(null as never);

      await expect(
        service.updateTask(ORG_ID, 99, { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should cascade completedAt to subtasks when status is DONE', async () => {
      const completedAt = new Date('2026-03-12');
      const taskWithSubtasks = {
        ...mockTask,
        subtasks: [{ id: 2 }, { id: 3 }],
      };
      (mockRepo.findById as jest.Mock).mockResolvedValue(mockTask as never);
      (mockRepo.update as jest.Mock).mockResolvedValue(
        taskWithSubtasks as never,
      );
      (mockRepo.updateSubtasksCompletedAt as jest.Mock).mockResolvedValue(
        undefined as never,
      );

      await service.updateTask(ORG_ID, 1, {
        status: TaskStatus.DONE,
        completedAt,
      });

      expect(mockRepo.updateSubtasksCompletedAt).toHaveBeenCalledWith(
        1,
        completedAt,
      );
    });

    it('should not cascade when status is DONE but completedAt is missing', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(mockTask as never);
      (mockRepo.update as jest.Mock).mockResolvedValue({
        ...mockTask,
        subtasks: [{ id: 2 }],
      } as never);

      await service.updateTask(ORG_ID, 1, { status: TaskStatus.DONE });

      expect(mockRepo.updateSubtasksCompletedAt).not.toHaveBeenCalled();
    });

    it('should not cascade when task has no subtasks', async () => {
      const completedAt = new Date('2026-03-12');
      (mockRepo.findById as jest.Mock).mockResolvedValue(mockTask as never);
      (mockRepo.update as jest.Mock).mockResolvedValue(mockTask as never); // subtasks: []

      await service.updateTask(ORG_ID, 1, {
        status: TaskStatus.DONE,
        completedAt,
      });

      expect(mockRepo.updateSubtasksCompletedAt).not.toHaveBeenCalled();
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(mockTask as never);
      (mockRepo.delete as jest.Mock).mockResolvedValue(mockTask as never);

      await service.deleteTask(ORG_ID, 1);

      expect(mockRepo.delete).toHaveBeenCalledWith(1, ORG_ID);
    });

    it('should throw NotFoundException when task does not exist', async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(null as never);

      await expect(service.deleteTask(ORG_ID, 99)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });
});
