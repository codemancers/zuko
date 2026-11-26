import { HarnessController } from './harness.controller';
import { HarnessGrantsService } from '../libs/eve/harness-grants.service';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AssociationsController } from './associations.controller';
import { AssociationsService } from './associations.service';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CrmContextGuard, CrmContextService } from './context';
import { DirectoryController } from './directory.controller';
import { DirectoryService } from './directory.service';
import { EveController } from './eve.controller';
import { CrmExceptionFilter } from './errors';
import { ObjectsController } from './objects.controller';
import { RecordsController } from './records.controller';
import { RecordFilesService } from './record-files.service';
import { RecordsQueryService } from './records-query.service';
import { RecordsService } from './records.service';
import { SchemaService } from './schema.service';
import { SharesService } from './shares.service';

@Module({
  exports: [
    SchemaService,
    RecordsService,
    AssociationsService,
    RecordsQueryService,
    DirectoryService,
    CrmContextService,
    RecordFilesService,
  ],
  controllers: [
    ObjectsController,
    RecordsController,
    AssociationsController,
    CommentsController,
    AccessController,
    DirectoryController,
    EveController,
    HarnessController,
  ],
  providers: [
    SchemaService,
    RecordsService,
    AssociationsService,
    CommentsService,
    RecordsQueryService,
    AccessService,
    SharesService,
    DirectoryService,
    CrmContextGuard,
    HarnessGrantsService,
    CrmContextService,
    RecordFilesService,
    { provide: APP_FILTER, useClass: CrmExceptionFilter },
  ],
})
export class CrmModule {}
