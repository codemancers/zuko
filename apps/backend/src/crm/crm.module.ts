import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CrmContextGuard } from './context';
import { CrmExceptionFilter } from './errors';
import { ObjectsController } from './objects.controller';
import { RecordsController } from './records.controller';
import { RecordsQueryService } from './records-query.service';
import { RecordsService } from './records.service';
import { SchemaService } from './schema.service';

@Module({
  controllers: [ObjectsController, RecordsController],
  providers: [SchemaService, RecordsService, RecordsQueryService, CrmContextGuard, { provide: APP_FILTER, useClass: CrmExceptionFilter }],
})
export class CrmModule {}
