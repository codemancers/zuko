import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, ValidateIf } from 'class-validator';
import type { TaskStatus, TaskPriority, EditorData } from '@zuko/sales';

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

  @ApiPropertyOptional({
    enum: ['low', 'medium', 'high', 'urgent'],
    example: 'medium',
  })
  priority?: TaskPriority;

  @ApiPropertyOptional({ type: Boolean })
  // Omission is allowed; null and other nonbooleans must still be rejected.
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isSales?: boolean;

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
