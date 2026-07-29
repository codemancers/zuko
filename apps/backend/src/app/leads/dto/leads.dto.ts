import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLeadDto {
  @ApiProperty()
  @IsInt()
  icpProfileId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  campaignId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  contactId?: number;

  @ApiProperty()
  @IsString()
  name: string;

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

  @ApiPropertyOptional({
    default: 'replied',
    enum: ['replied', 'interested', 'not_interested', 'converted'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    default: 'manual',
    enum: ['apollo', 'origami', 'linkedin', 'manual'],
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apolloPersonId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLeadDto {
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

  @ApiPropertyOptional({
    enum: ['replied', 'interested', 'not_interested', 'converted'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListLeadsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  perPage?: number;

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

  @ApiPropertyOptional({ isArray: true, type: String })
  @IsOptional()
  @IsString({ each: true })
  status?: string | string[];

  @ApiPropertyOptional({ isArray: true, type: String })
  @IsOptional()
  @IsString({ each: true })
  source?: string | string[];
}
