import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export const MeetingSchema = z.object({
  url: z.string().min(1, 'Meeting URL is required'),
  name: z.string().optional(),
  description: z.string().optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  timezone: z.string().optional(),
});

export type MeetingDto = z.infer<typeof MeetingSchema>;

export const CallbackSchema = z.object({
  meetingId: z.string(),
  event: z.string(),
  data: z
    .object({
      recording: z.string().optional(),
      transcript: z.string().optional(),
      flyMachineId: z.string().optional(),
    })
    .optional(),
});
export type CallbackDto = z.infer<typeof CallbackSchema>;

export const TranscriptChunkSchema = z
  .object({
    text: z.string().default('').optional(),
    speaker_name: z.string().optional(),
    duration_seconds: z.number().optional(),
    sequence: z.number().int().optional(),
    isFinal: z.boolean().optional(),
  })
  .refine((val) => val.isFinal || (val.text && val.text.trim().length > 0), {
    message: 'text is required unless isFinal is true',
    path: ['text'],
  });
export type TranscriptChunkDto = z.infer<typeof TranscriptChunkSchema>;

/** API documentation class for meeting creation — Zod still handles runtime validation */
export class MeetingApiDto {
  @ApiProperty({
    example: 'https://meet.google.com/abc-defg-hij',
    description: 'Meeting URL',
  })
  url!: string;

  @ApiPropertyOptional({ example: 'Weekly Standup' })
  name?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-05-19T10:00:00Z',
  })
  scheduledAt?: string;

  @ApiPropertyOptional({ example: 'America/New_York' })
  timezone?: string;
}

/** API documentation class for meeting webhook callback */
export class CallbackApiDto {
  @ApiProperty()
  meetingId!: string;

  @ApiProperty()
  event!: string;

  @ApiPropertyOptional({ type: Object, description: 'Callback data payload' })
  data?: { recording?: string; transcript?: string; flyMachineId?: string };
}

/** API documentation class for transcript chunk */
export class TranscriptChunkApiDto {
  @ApiPropertyOptional()
  text?: string;

  @ApiPropertyOptional()
  speaker_name?: string;

  @ApiPropertyOptional({ type: Number })
  duration_seconds?: number;

  @ApiPropertyOptional({ type: Number })
  sequence?: number;

  @ApiPropertyOptional({ type: Boolean })
  isFinal?: boolean;
}

/** API documentation class for action item update */
export class UpdateActionItemApiDto {
  @ApiProperty()
  taskId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;
}
