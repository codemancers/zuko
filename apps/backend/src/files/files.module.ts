import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CrmModule } from '../crm/crm.module';
import { HarnessGrantsService } from '../libs/eve/harness-grants.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MAX_FILE_BYTES } from './file-types';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { UploadLinksController } from './upload-links.controller';
import { UploadRoleGuard } from './upload-role.guard';
import { UploadTicketGuard } from './upload-ticket.guard';
import { UploadTicketsService } from './upload-tickets.service';
import { createMulterStorage } from './multer-storage';
import { FileStorageModule } from './file-storage.module';
import { FILE_STORAGE, type FileStorage } from './storage';

@Module({
  imports: [
    PrismaModule,
    CrmModule,
    FileStorageModule,
    MulterModule.registerAsync({
      imports: [FileStorageModule],
      inject: [FILE_STORAGE],
      useFactory: (storage: FileStorage) => ({
        storage: createMulterStorage(storage),
        limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 0 },
      }),
    }),
  ],
  // The upload-link routes come first so `uploads` is never read as a file id.
  controllers: [UploadLinksController, FilesController],
  providers: [FilesService, HarnessGrantsService, UploadTicketsService, UploadTicketGuard, UploadRoleGuard],
})
export class FilesModule {}
