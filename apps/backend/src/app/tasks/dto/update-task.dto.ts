import type { TaskStatus, EditorData } from '@zuko/sales';

export class UpdateTaskDto {
  title?: string;
  description?: EditorData;
  status?: TaskStatus;
  completedAt?: Date | null;
  parentId?: number | null;
  assignee?: string | null;
}
