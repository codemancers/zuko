import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class SearchProspectsDto {
  @ApiPropertyOptional({ description: 'Full or partial name of the person' })
  @IsOptional()
  @IsString()
  personName?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Job titles to filter by (OR logic)',
    example: ['Software Engineer', 'Engineering Manager'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  personTitles?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Locations to filter by (city, state, or country)',
    example: ['Bengaluru', 'India'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  personLocations?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Apollo organization IDs to filter by',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  organizationIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Organization domains to filter by e.g. ["codemancers.com"]',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  organizationDomains?: string[];

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;
}

export class ProspectPersonDataDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationName?: string;
}

export class AddPeopleToSequenceDto {
  @ApiProperty({ description: 'Apollo sequence ID to enroll people into' })
  @IsString()
  sequenceId!: string;

  @ApiProperty({
    type: [String],
    description: 'Zuko CRM contact IDs (already Apollo contacts)',
  })
  @IsArray()
  @IsString({ each: true })
  contactIds!: string[];

  @ApiProperty({
    type: [String],
    description: 'Raw Apollo person IDs (prospects not yet in CRM)',
  })
  @IsArray()
  @IsString({ each: true })
  personIds!: string[];

  @ApiProperty({
    type: [ProspectPersonDataDto],
    description: 'Minimal data for each personId — used to create CRM records',
  })
  @IsArray()
  personData!: ProspectPersonDataDto[];
}
