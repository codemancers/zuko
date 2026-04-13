import { Controller, Get } from '@nestjs/common';
import { MetadataService } from './metadata.service';

@Controller('metadata')
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Get('currencies')
  getCurrencies() {
    return this.metadataService.getCurrencies();
  }
}
