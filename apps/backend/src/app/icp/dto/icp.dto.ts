import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PersonSeniority {
  OWNER = 'owner',
  FOUNDER = 'founder',
  C_SUITE = 'c_suite',
  PARTNER = 'partner',
  VP = 'vp',
  HEAD = 'head',
  DIRECTOR = 'director',
  MANAGER = 'manager',
  SENIOR = 'senior',
  ENTRY = 'entry',
  INTERN = 'intern',
}

export enum ContactEmailStatus {
  VERIFIED = 'verified',
  UNVERIFIED = 'unverified',
  LIKELY_TO_ENGAGE = 'likely to engage',
  UNAVAILABLE = 'unavailable',
}

export class NumberRangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  max?: number;
}

export class DateRangeDto {
  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD' })
  min?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD' })
  max?: string;
}

export class IcpFiltersDto {
  // ── Existing fields (unchanged) ───────────────────────────────────────────

  @ApiPropertyOptional({ type: [String], example: ['saas', 'fintech'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industries?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Employee count ranges as "min,max" strings',
    example: ['50,200', '200,500'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  employeeRanges?: string[];

  @ApiPropertyOptional({
    type: NumberRangeDto,
    description: 'Annual revenue range in USD',
    example: { min: 1000000, max: 50000000 },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NumberRangeDto)
  revenueRange?: NumberRangeDto;

  @ApiPropertyOptional({ type: [String], example: ['United States', 'Canada'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  // ── Company identification ─────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'Apollo' })
  @IsOptional()
  @IsString()
  organizationName?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['5e66b6381e05b4008c8331b8'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  organizationIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['apollo.io', 'microsoft.com'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  organizationDomains?: string[];

  // ── Location exclusion ────────────────────────────────────────────────────

  @ApiPropertyOptional({ type: [String], example: ['Russia', 'China'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeLocations?: string[];

  // ── Technographics ────────────────────────────────────────────────────────

  @ApiPropertyOptional({ type: [String], example: ['salesforce', 'hubspot'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technologiesAnyOf?: string[];

  @ApiPropertyOptional({ type: [String], example: ['salesforce', 'slack'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technologiesAllOf?: string[];

  @ApiPropertyOptional({ type: [String], example: ['wordpress_org'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technologiesNoneOf?: string[];

  // ── Funding ───────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ type: NumberRangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NumberRangeDto)
  latestFundingAmountRange?: NumberRangeDto;

  @ApiPropertyOptional({ type: NumberRangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NumberRangeDto)
  totalFundingRange?: NumberRangeDto;

  @ApiPropertyOptional({ type: DateRangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  latestFundingDateRange?: DateRangeDto;

  // ── People-specific (forwarded only in /contacts search) ──────────────────

  @ApiPropertyOptional({ type: [String], example: ['VP of Sales', 'CTO'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  personTitles?: string[];

  @ApiPropertyOptional({ enum: PersonSeniority, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(PersonSeniority, { each: true })
  personSeniorities?: PersonSeniority[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeSimilarTitles?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['San Francisco', 'New York'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  personLocations?: string[];

  @ApiPropertyOptional({ enum: ContactEmailStatus, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(ContactEmailStatus, { each: true })
  contactEmailStatus?: ContactEmailStatus[];

  @ApiPropertyOptional({ example: 'enterprise software CRM' })
  @IsOptional()
  @IsString()
  keywords?: string;
}

export class RefineFiltersDto {
  @ApiProperty() description!: string;

  @ApiPropertyOptional({ type: IcpFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => IcpFiltersDto)
  currentFilters?: IcpFiltersDto;
}

export class CreateIcpProfileDto {
  @ApiProperty({ example: 'SaaS Mid-Market' })
  name!: string;

  @ApiPropertyOptional({ description: 'EditorJS OutputData JSON' })
  description?: Record<string, unknown>;

  @ApiPropertyOptional({ type: IcpFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => IcpFiltersDto)
  filters?: IcpFiltersDto;
}

export class UpdateIcpProfileDto {
  @ApiPropertyOptional({ example: 'SaaS Mid-Market' })
  name?: string;

  @ApiPropertyOptional({ description: 'EditorJS OutputData JSON' })
  description?: Record<string, unknown>;

  @ApiPropertyOptional({ type: IcpFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => IcpFiltersDto)
  filters?: IcpFiltersDto;

  @ApiPropertyOptional({ description: 'EditorJS OutputData JSON' })
  notes?: Record<string, unknown>;
}

export class ApolloSearchQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1 })
  page?: number;

  @ApiPropertyOptional({ type: Number, default: 25 })
  perPage?: number;
}

export class CompileDescriptionDto {
  @ApiProperty({
    example:
      'SaaS companies using Infor, 200-500 employees, targeting CFOs in the USA',
  })
  @IsString()
  @MinLength(10)
  description!: string;
}

export class ClassifyIntentDto {
  @ApiProperty({ example: 'yes' })
  @IsString()
  @MinLength(1)
  description!: string;
}

export class PreviewFiltersDto {
  @ApiProperty({ type: IcpFiltersDto })
  @ValidateNested()
  @Type(() => IcpFiltersDto)
  filters!: IcpFiltersDto;
}

export class PreviewFiltersResponseDto {
  @ApiProperty({ nullable: true, type: Number }) companiesCount!: number | null;
  @ApiProperty({ nullable: true, type: Number }) contactsCount!: number | null;
  @ApiProperty({ enum: ['ok', 'warn', 'broad'], nullable: true })
  filterBreadth!: 'ok' | 'warn' | 'broad' | null;
}
