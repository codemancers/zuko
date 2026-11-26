import { Module } from '@nestjs/common';
import { createLocalStorage, FILE_STORAGE } from './storage';

/** The one place the storage driver is chosen. Swap `createLocalStorage` here for an S3 driver later. */
@Module({
  providers: [{ provide: FILE_STORAGE, useFactory: () => createLocalStorage() }],
  exports: [FILE_STORAGE],
})
export class FileStorageModule {}
