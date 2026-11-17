import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CrmContextGuard } from './context';
import { CrmExceptionFilter } from './errors';
import { ObjectsController } from './objects.controller';
import { SchemaService } from './schema.service';

@Module({
  controllers: [ObjectsController],
  providers: [SchemaService, CrmContextGuard, { provide: APP_FILTER, useClass: CrmExceptionFilter }],
})
export class CrmModule {}
