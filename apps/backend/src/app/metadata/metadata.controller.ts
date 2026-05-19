import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetadataService } from './metadata.service';

@ApiTags('Metadata')
@Controller('metadata')
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Get('currencies')
  @ApiOperation({ summary: 'List supported currency codes' })
  @ApiResponse({ status: 200, description: 'Array of currency codes' })
  getCurrencies() {
    return this.metadataService.getCurrencies();
  }

  @Get('deal/priorities')
  @ApiOperation({ summary: 'List deal priority levels' })
  @ApiResponse({ status: 200, description: 'Array of priority values' })
  getPriorities() {
    return this.metadataService.getDealPriorities();
  }

  @Get('deal/stages')
  @ApiOperation({ summary: 'List deal pipeline stages' })
  @ApiResponse({ status: 200, description: 'Array of stage names' })
  getStages() {
    return this.metadataService.getDealStages();
  }

  @Get('task/status')
  @ApiOperation({ summary: 'List task status values' })
  @ApiResponse({ status: 200, description: 'Array of task status values' })
  getTaskStatuses() {
    return this.metadataService.getTaskStatuses();
  }
}
