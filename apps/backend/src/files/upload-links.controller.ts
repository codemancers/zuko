import { Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { Crm, CrmContextGuard, HarnessAccess, type RequestContext } from '../crm/context';
import { FilesService } from './files.service';
import type { StoredUpload } from './multer-storage';
import { UploadRoleGuard } from './upload-role.guard';
import { UploadTicketGuard } from './upload-ticket.guard';
import { UploadTicketsService } from './upload-tickets.service';

/**
 * Upload without the user's token. `POST /files/uploads` (signed in) returns a short-lived, single-use
 * link; `POST /files/uploads/:token` (the link itself is the credential) takes the bytes as multipart and
 * returns the stored file. The link is a bearer capability: keep it out of logs and chats.
 */
@Controller('v1/files/uploads')
export class UploadLinksController {
  constructor(
    private readonly tickets: UploadTicketsService,
    private readonly files: FilesService,
  ) {}

  @Post()
  @UseGuards(CrmContextGuard)
  @HarnessAccess('records:write')
  issue(@Crm() ctx: RequestContext) {
    return this.tickets.issue(ctx);
  }

  @Post(':token')
  @AllowAnonymous()
  @UseGuards(UploadTicketGuard, UploadRoleGuard)
  @UseInterceptors(FileInterceptor('file'))
  upload(@Crm() ctx: RequestContext, @UploadedFile() file: Partial<StoredUpload> | undefined) {
    return this.files.register(ctx, file);
  }
}
