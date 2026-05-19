import { ApiPropertyOptional } from '@nestjs/swagger';
import type { TaskStatus, EditorData } from '@zuko/sales';

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Follow up with client' })
  title?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Rich-text description (EditorJS format)',
  })
  description?: EditorData;

  @ApiPropertyOptional({
    enum: ['todo', 'in_progress', 'done'],
    example: 'todo',
  })
  status?: TaskStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  completedAt?: Date | null;

  @ApiPropertyOptional({
    type: Number,
    description: 'Parent task ID for subtasks',
    nullable: true,
  })
  parentId?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  assignee?: string | null;
}
