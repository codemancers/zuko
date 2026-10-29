import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, ValidateIf } from 'class-validator';
import type { TaskStatus, TaskPriority, EditorData } from '@zuko/sales';

export class CreateTaskDto {
  @ApiProperty({ example: 'Follow up with client' })
  title!: string;

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

  @ApiPropertyOptional({ type: Boolean, default: false })
  // Omission is allowed; null and other nonbooleans must still be rejected.
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isSales?: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  completedAt?: Date;

  @ApiPropertyOptional({
    type: Number,
    description: 'Parent task ID for subtasks',
    nullable: true,
  })
  parentId?: number;

  @ApiPropertyOptional({
    type: String,
    example: 'user-id-string',
    nullable: true,
  })
  assignee?: string;
}
