import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IcpFiltersDto {
  @ApiPropertyOptional({ type: [String], example: ['saas', 'fintech'] })
  industries?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Employee count ranges as "min,max" strings',
    example: ['50,200', '200,500'],
  })
  employeeRanges?: string[];

  @ApiPropertyOptional({
    type: Object,
    description: 'Annual revenue range in USD',
    example: { min: 1000000, max: 50000000 },
  })
  revenueRange?: { min?: number; max?: number };

  @ApiPropertyOptional({
    type: [String],
    example: ['United States', 'Canada'],
  })
  locations?: string[];
}

export class CreateIcpProfileDto {
  @ApiProperty({ example: 'SaaS Mid-Market' })
  name!: string;

  @ApiPropertyOptional({ description: 'EditorJS OutputData JSON' })
  description?: Record<string, unknown>;

  @ApiPropertyOptional({ type: IcpFiltersDto })
  filters?: IcpFiltersDto;
}

export class UpdateIcpProfileDto {
  @ApiPropertyOptional({ example: 'SaaS Mid-Market' })
  name?: string;

  @ApiPropertyOptional({ description: 'EditorJS OutputData JSON' })
  description?: Record<string, unknown>;

  @ApiPropertyOptional({ type: IcpFiltersDto })
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
