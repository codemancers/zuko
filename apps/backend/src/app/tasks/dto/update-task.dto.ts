import { TaskStatus } from '@zuko/sales';

export class UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  completedAt?: Date | null;
  parentId?: number | null;
  assignee?: string | null;
}
