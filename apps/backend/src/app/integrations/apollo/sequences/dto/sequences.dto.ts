import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  IsInt,
  IsBoolean,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  icpProfileId?: number;
}

export class EmailerTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty()
  @IsString()
  bodyHtml!: string;
}

export class EmailerTouchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apolloTouchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apolloTemplateId?: string;

  @ApiProperty({ enum: ['new_thread', 'reply_to_thread'] })
  @IsIn(['new_thread', 'reply_to_thread'])
  type!: 'new_thread' | 'reply_to_thread';

  @ApiProperty({ type: () => EmailerTemplateDto })
  @ValidateNested()
  @Type(() => EmailerTemplateDto)
  emailerTemplate!: EmailerTemplateDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeSignature?: boolean;

  @ApiPropertyOptional({ enum: ['approved', 'to_be_reviewed'] })
  @IsOptional()
  @IsIn(['approved', 'to_be_reviewed'])
  status?: 'approved' | 'to_be_reviewed';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasPersonalizedOpener?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  genericPersonalizedOpener?: string;

  @ApiPropertyOptional({ enum: ['skip', 'use_generic'] })
  @IsOptional()
  @IsIn(['skip', 'use_generic'])
  personalizedOpenerFallbackOption?: 'skip' | 'use_generic';
}

export class SequenceStepDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apolloStepId?: string;

  @ApiProperty({ enum: ['auto_email', 'manual_email'] })
  @IsIn(['auto_email', 'manual_email'])
  type!: 'auto_email' | 'manual_email';

  @ApiProperty()
  @IsInt()
  @Min(0)
  waitTime!: number;

  @ApiPropertyOptional({ enum: ['day', 'hour', 'minute'] })
  @IsOptional()
  @IsIn(['day', 'hour', 'minute'])
  waitMode?: 'day' | 'hour' | 'minute';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high'] })
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  autoSkipInXDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  maxEmailsPerDay?: number;

  @ApiProperty({ type: () => [EmailerTouchDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailerTouchDto)
  touches!: EmailerTouchDto[];
}

export class SaveSequenceDto {
  @ApiProperty({ type: () => [SequenceStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SequenceStepDto)
  sequence!: SequenceStepDto[];

  @ApiPropertyOptional({ enum: ['private', 'team_can_view', 'team_can_use'] })
  @IsOptional()
  @IsIn(['private', 'team_can_view', 'team_can_use'])
  permissions?: 'private' | 'team_can_view' | 'team_can_use';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailerScheduleId?: string;
}

export class SearchSequencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perPage?: number;
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
  @IsString({ each: true })
  labelNames?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  icpProfileId?: number;

  @ApiProperty({ type: () => [SequenceStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SequenceStepDto)
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
