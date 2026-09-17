import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CAMPAIGN_DISPOSITION_VALUES,
  CAMPAIGN_EVENT_VALUES,
  CONSENT_STATE_VALUES,
  CONTACT_CHANNEL_VALUES,
  ENGAGEMENT_STATE_VALUES,
  PROSPECT_STATUS_VALUES,
} from '@zuko/sales';

export class CreateProspectDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apolloPersonId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  icpProfileId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  contactId?: number;

  @ApiPropertyOptional({ default: 'manual' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  notes?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateProspectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  icpProfileId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  notes?: Record<string, unknown>;
}

export class ListProspectsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  icpProfileId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  campaignId?: number;

  @ApiPropertyOptional({ enum: PROSPECT_STATUS_VALUES, isArray: true })
  @IsOptional()
  @IsArray()
  @Type(() => String)
  status?: string[];

  @ApiPropertyOptional({ enum: ENGAGEMENT_STATE_VALUES, isArray: true })
  @IsOptional()
  @IsArray()
  @Type(() => String)
  engagement?: string[];

  @ApiPropertyOptional({ isArray: true })
  @IsOptional()
  @IsArray()
  @Type(() => String)
  source?: string[];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  perPage?: number;
}

export class SetProspectStatusDto {
  @ApiProperty({ enum: PROSPECT_STATUS_VALUES })
  @IsString()
  status!: string;

  @ApiPropertyOptional({
    description:
      'Marks this as an explicit operator action. Required to leave suppression or disqualification.',
  })
  @IsOptional()
  @IsBoolean()
  manual?: boolean;
}

export class EnrolProspectDto {
  @ApiProperty()
  @IsInt()
  campaignId!: number;

  @ApiPropertyOptional({ enum: CONTACT_CHANNEL_VALUES, default: 'email' })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({
    description:
      'Override the eligibility safeguards. Never lifts an opt-out — a suppressed prospect stays blocked.',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class RecordCampaignEventDto {
  @ApiProperty({ enum: CAMPAIGN_EVENT_VALUES })
  @IsString()
  eventType!: string;

  @ApiPropertyOptional({
    description: 'Provider event id — makes webhook replay idempotent.',
  })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class SetDispositionDto {
  @ApiProperty({ enum: CAMPAIGN_DISPOSITION_VALUES })
  @IsString()
  disposition!: string;

  @ApiPropertyOptional({
    description:
      'For "nurture": when we may approach them again. Defaults to the standard cooldown.',
  })
  @IsOptional()
  @IsDateString()
  nextEligibleAt?: string;
}

export class SetConsentDto {
  @ApiProperty({ enum: CONTACT_CHANNEL_VALUES })
  @IsString()
  channel!: string;

  @ApiProperty({ enum: CONSENT_STATE_VALUES })
  @IsString()
  consent!: string;
}
