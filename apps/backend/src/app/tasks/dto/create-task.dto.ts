import { TaskStatus } from '@zuko/sales';

export class CreateTaskDto {
  title!: string;
  description?: string;
  status?: TaskStatus;
  completedAt?: Date;
  parentId?: number;
  assignee?: string;
}
