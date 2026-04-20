import { TaskStatus, EditorData } from '@zuko/sales';

export class CreateTaskDto {
  title!: string;
  description?: EditorData;
  status?: TaskStatus;
  completedAt?: Date;
  parentId?: number;
  assignee?: string;
}
