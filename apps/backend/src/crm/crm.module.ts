import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { CrmContextGuard } from './context';
import { CrmExceptionFilter } from './errors';
import { ObjectsController } from './objects.controller';
import { RecordsController } from './records.controller';
import { RecordsQueryService } from './records-query.service';
import { RecordsService } from './records.service';
import { SchemaService } from './schema.service';
import { SharesService } from './shares.service';

@Module({
  controllers: [ObjectsController, RecordsController, AccessController],
  providers: [SchemaService, RecordsService, RecordsQueryService, AccessService, SharesService, CrmContextGuard, { provide: APP_FILTER, useClass: CrmExceptionFilter }],
})
export class CrmModule {}
