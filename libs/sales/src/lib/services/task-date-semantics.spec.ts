/**
 * Characterization tests for #7361 (task date semantics). They pin down how
 * the current code treats task timestamps and activity history; they do not
 * describe a desired contract. See docs/technical/task-date-semantics-7361.md.
 */
import { describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { TaskService } from './task.service';
import type { ActivityService } from './activity.service';
import type { TaskRepository } from '../repositories/task.repository';
import { TaskStatus } from '../repositories/task.repository';
import { TaskActivityListener } from '../listeners/task-activity.listener';
import { TASK_EVENTS } from '../events/task-events';
import { castFieldValue } from '../utils/custom-fields';

// Node re-reads process.env.TZ on assignment, so a zone can be pinned for one
// test without touching the machine setting. The offset assertions fail loudly
// if the runtime ever stops honouring the switch.
const originalTZ = process.env.TZ;
function useTimeZone(tz: string) {
  process.env.TZ = tz;
}
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

describe('castFieldValue date (table cell write path, server-side)', () => {
  it.each([
    ['UTC', 0, '2026-11-03T00:00:00.000Z'],
    ['Asia/Kolkata', -330, '2026-11-02T18:30:00.000Z'],
    ['America/Los_Angeles', 480, '2026-11-03T08:00:00.000Z'],
  ])(
    'turns date-only "2026-11-03" into server-local midnight in %s',
    (tz, expectedOffset, expectedIso) => {
      useTimeZone(tz);
      // 2026-11-03 is after US DST ended (Nov 1), so LA is UTC-8.
      expect(new Date('2026-11-03T12:00:00Z').getTimezoneOffset()).toBe(
        expectedOffset,
      );
      expect(castFieldValue('2026-11-03', 'date')).toBe(expectedIso);
    },
  );

  it('keeps a full ISO instant unchanged regardless of server zone', () => {
    useTimeZone('Asia/Kolkata');
    expect(castFieldValue('2026-11-02T20:00:00.000Z', 'date')).toBe(
      '2026-11-02T20:00:00.000Z',
    );
  });
});

describe('TaskService + TaskActivityListener: occurrence vs recording', () => {
  const ACTOR_ID = 42;
  const ORG_ID = 1;
  const current = {
    id: 7,
    organizationId: ORG_ID,
    title: 'Call Asha',
    description: null,
    status: TaskStatus.TODO,
    priority: 'MEDIUM',
    completedAt: null,
    parentId: null,
    assignee: 'Owner User',
    assigneeUserId: 5,
    assigneeUser: { id: 5, name: 'Owner User', email: 'o@example.com' },
    subtasks: [] as { id: number }[],
  };

  const repo = {
    findById: vi.fn(),
    update: vi.fn(),
    updateSubtasksCompletedAt: vi.fn(),
  };
  const activityService = { create: vi.fn() };
  const listener = new TaskActivityListener(
    activityService as unknown as ActivityService,
  );
  // Route emitted events to the real listener, as @OnEvent does at runtime.
  const handlers: Record<string, (e: never) => Promise<void>> = {
    [TASK_EVENTS.CREATED]: (e) => listener.handleTaskCreated(e),
    [TASK_EVENTS.STATUS_CHANGED]: (e) => listener.handleStatusChanged(e),
    [TASK_EVENTS.FIELD_UPDATED]: (e) => listener.handleFieldUpdated(e),
    [TASK_EVENTS.SUBTASK_ADDED]: (e) => listener.handleSubtaskAdded(e),
  };
  const emitter = {
    emitAsync: vi.fn(async (name: string, payload: never) =>
      handlers[name]?.(payload),
    ),
  };
  let service: TaskService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TaskService(
      repo as unknown as TaskRepository,
      emitter as unknown as EventEmitter2,
    );
    (repo.findById as Mock).mockResolvedValue(current);
    (activityService.create as Mock).mockResolvedValue(undefined);
  });

  it('records a backdated completion as a status change with no occurrence time', async () => {
    const backdated = new Date('2026-10-30T09:00:00.000Z');
    (repo.update as Mock).mockResolvedValue({
      ...current,
      status: TaskStatus.DONE,
      completedAt: backdated,
    });

    await service.updateTask(
      ORG_ID,
      7,
      { status: TaskStatus.DONE, completedAt: backdated },
      ACTOR_ID,
    );

    // completedAt reaches the task row as given...
    expect(repo.update).toHaveBeenCalledWith(7, ORG_ID, {
      status: TaskStatus.DONE,
      completedAt: backdated,
    });
    // ...but the only history row carries the actor and from/to, nothing
    // about when the work happened. Activity.createdAt falls to the DB
    // default (recording time).
    expect(activityService.create).toHaveBeenCalledTimes(1);
    expect(activityService.create).toHaveBeenCalledWith({
      activityType: 'task_status_changed',
      entityType: 'task',
      entityId: 7,
      actorId: ACTOR_ID,
      metadata: { from: TaskStatus.TODO, to: TaskStatus.DONE },
    });
  });

  it('records nothing when only completedAt is changed', async () => {
    const corrected = new Date('2026-10-29T09:00:00.000Z');
    (repo.update as Mock).mockResolvedValue({
      ...current,
      status: TaskStatus.DONE,
      completedAt: corrected,
    });

    await service.updateTask(ORG_ID, 7, { completedAt: corrected }, ACTOR_ID);

    expect(repo.update).toHaveBeenCalledOnce();
    expect(emitter.emitAsync).not.toHaveBeenCalled();
    expect(activityService.create).not.toHaveBeenCalled();
  });

  it('does not stamp completedAt when status moves to DONE without one', async () => {
    (repo.update as Mock).mockResolvedValue({
      ...current,
      status: TaskStatus.DONE,
    });

    await service.updateTask(ORG_ID, 7, { status: TaskStatus.DONE }, ACTOR_ID);

    expect(repo.update).toHaveBeenCalledWith(7, ORG_ID, {
      status: TaskStatus.DONE,
    });
    expect(repo.updateSubtasksCompletedAt).not.toHaveBeenCalled();
  });

  it('copies the parent completedAt onto subtasks without history rows for them', async () => {
    const at = new Date('2026-10-30T09:00:00.000Z');
    (repo.update as Mock).mockResolvedValue({
      ...current,
      status: TaskStatus.DONE,
      completedAt: at,
      subtasks: [{ id: 8 }, { id: 9 }],
    });

    await service.updateTask(
      ORG_ID,
      7,
      { status: TaskStatus.DONE, completedAt: at },
      ACTOR_ID,
    );

    expect(repo.updateSubtasksCompletedAt).toHaveBeenCalledWith(7, at);
    const entityIds = (activityService.create as Mock).mock.calls.map(
      ([input]) => input.entityId,
    );
    expect(entityIds).toEqual([7]);
  });
});
