import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsPositive,
  Max,
  Validate,
  ValidateIf,
} from 'class-validator';
import type { TaskStatus, TaskPriority, EditorData } from '@zuko/sales';
import { SinglePersonReference } from './single-person-reference.validator';
import { DueDateString } from './due-date.validator';

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
    type: String,
    format: 'date',
    nullable: true,
    example: '2026-11-03',
    description: 'Calendar day (YYYY-MM-DD). null clears it; omit to keep it.',
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Validate(DueDateString)
  dueDate?: string | null;

  @ApiPropertyOptional({
    type: Number,
    description: 'Parent task ID for subtasks',
    nullable: true,
  })
  parentId?: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Legacy display name. Writing it alone clears assigneeUserId; ignored when assigneeUserId is sent.',
  })
  assignee?: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'User ID of an organization member. null clears the assignee; omit to keep it.',
  })
  // Omission and explicit null are allowed; anything else must be a positive integer.
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsInt()
  @IsPositive()
  // Postgres INTEGER bound; larger values would fail in Prisma with a 500.
  @Max(2_147_483_647)
  assigneeUserId?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Sales contact this task is about. Setting it clears prospectId; null clears it; omit to keep it.',
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsInt()
  @IsPositive()
  @Max(2_147_483_647)
  @Validate(SinglePersonReference)
  contactId?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Sales prospect this task is about. Setting it clears contactId; null clears it; omit to keep it.',
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsInt()
  @IsPositive()
  @Max(2_147_483_647)
  prospectId?: number | null;
}
