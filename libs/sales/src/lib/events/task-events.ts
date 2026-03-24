export const TASK_EVENTS = {
  CREATED: 'task.created',
  STATUS_CHANGED: 'task.status_changed',
  FIELD_UPDATED: 'task.field_updated',
  SUBTASK_ADDED: 'task.subtask_added',
} as const;

interface TaskEventBase {
  taskId: number;
  actorId?: number;
}

export type TaskCreatedEvent = TaskEventBase;

export interface TaskStatusChangedEvent extends TaskEventBase {
  from: string;
  to: string;
}

export interface TaskFieldUpdatedEvent extends TaskEventBase {
  field: string;
  from: unknown;
  to: unknown;
}

export interface TaskSubtaskAddedEvent extends TaskEventBase {
  subtaskId: number;
  subtaskTitle: string;
}
