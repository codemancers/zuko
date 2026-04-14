import { Controller, Get } from '@nestjs/common';
import { MetadataService } from './metadata.service';

@Controller('metadata')
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Get('currencies')
  getCurrencies() {
    return this.metadataService.getCurrencies();
  }

  @Get('deal/priorities')
  getPriorities() {
    return this.metadataService.getDealPriorities();
  }

  @Get('deal/stages')
  getStages() {
    return this.metadataService.getDealStages();
  }

  @Get('task/status')
  getTaskStatuses() {
    return this.metadataService.getTaskStatuses();
  }
}
