import { IsString, IsOptional, IsArray, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchSequencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  perPage?: number;
}

export interface EmailerTemplateDto {
  subject?: string;
  bodyHtml: string;
}

export interface EmailerTouchDto {
  apolloTouchId?: string;
  apolloTemplateId?: string;
  type: 'new_thread' | 'reply_to_thread';
  emailerTemplate: EmailerTemplateDto;
  includeSignature?: boolean;
  status?: 'approved' | 'to_be_reviewed';
  hasPersonalizedOpener?: boolean;
  genericPersonalizedOpener?: string;
  personalizedOpenerFallbackOption?: 'skip' | 'use_generic';
}

export interface SequenceStepDto {
  apolloStepId?: string;
  type: 'auto_email' | 'manual_email';
  waitTime: number;
  waitMode?: 'day' | 'hour' | 'minute';
  note?: string;
  priority?: 'low' | 'medium' | 'high';
  autoSkipInXDays?: number;
  maxEmailsPerDay?: number;
  touches: EmailerTouchDto[];
}

export class CreateSequenceDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ enum: ['private', 'team_can_view', 'team_can_use'] })
  @IsOptional()
  @IsIn(['private', 'team_can_view', 'team_can_use'])
  permissions?: 'private' | 'team_can_view' | 'team_can_use';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailerScheduleId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  labelNames?: string[];

  @ApiProperty()
  @IsArray()
  sequence!: SequenceStepDto[];
}

export class AddContactsToSequenceDto {
  @ApiProperty()
  @IsString()
  sequenceId!: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  contactIds!: string[];
}
