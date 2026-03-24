import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TaskActivityListener } from './task-activity.listener';
import { ActivityService } from '../services/activity.service';

const TASK_ID = 20;
const ACTOR_ID = 42;

describe('TaskActivityListener', () => {
  let listener: TaskActivityListener;
  const mockActivityService = { create: jest.fn() };

  beforeEach(() => {
    listener = new TaskActivityListener(
      mockActivityService as unknown as ActivityService,
    );
    jest.clearAllMocks();
    (mockActivityService.create as jest.Mock).mockResolvedValue(undefined as never);
  });

  describe('handleTaskCreated', () => {
    it('calls activityService.create with task_created', async () => {
      await listener.handleTaskCreated({ taskId: TASK_ID, actorId: ACTOR_ID });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'task_created',
        entityType: 'task',
        entityId: TASK_ID,
        actorId: ACTOR_ID,
        metadata: {},
      });
    });

    it('works without actorId', async () => {
      await listener.handleTaskCreated({ taskId: TASK_ID });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'task_created',
        entityType: 'task',
        entityId: TASK_ID,
        actorId: undefined,
        metadata: {},
      });
    });
  });

  describe('handleStatusChanged', () => {
    it('calls activityService.create with task_status_changed', async () => {
      await listener.handleStatusChanged({
        taskId: TASK_ID,
        actorId: ACTOR_ID,
        from: 'TODO',
        to: 'IN_PROGRESS',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'task_status_changed',
        entityType: 'task',
        entityId: TASK_ID,
        actorId: ACTOR_ID,
        metadata: { from: 'TODO', to: 'IN_PROGRESS' },
      });
    });
  });

  describe('handleFieldUpdated', () => {
    it('calls activityService.create with field_update for title', async () => {
      await listener.handleFieldUpdated({
        taskId: TASK_ID,
        actorId: ACTOR_ID,
        field: 'title',
        from: 'Old Title',
        to: 'New Title',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'field_update',
        entityType: 'task',
        entityId: TASK_ID,
        actorId: ACTOR_ID,
        metadata: { field: 'title', from: 'Old Title', to: 'New Title' },
      });
    });

    it('calls activityService.create with field_update for assignee', async () => {
      await listener.handleFieldUpdated({
        taskId: TASK_ID,
        actorId: ACTOR_ID,
        field: 'assignee',
        from: null,
        to: 'Alice',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'field_update',
        entityType: 'task',
        entityId: TASK_ID,
        actorId: ACTOR_ID,
        metadata: { field: 'assignee', from: null, to: 'Alice' },
      });
    });
  });
});
