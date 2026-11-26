import {
  Controller, Delete, Get, HttpCode, Param, Post, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Crm, CrmContextGuard, HarnessAccess, type RequestContext } from '../crm/context';
import { INLINE_TYPES } from './file-types';
import { FilesService } from './files.service';
import type { StoredUpload } from './multer-storage';
import { UploadRoleGuard } from './upload-role.guard';

interface HttpResponse {
  setHeader(name: string, value: string): void;
}

/** A Content-Disposition value with an ASCII fallback and the UTF-8 name (RFC 6266 / 5987). */
const disposition = (kind: 'inline' | 'attachment', filename: string) =>
  `${kind}; filename="${filename.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`;

@Controller('v1/files')
@UseGuards(CrmContextGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /** The only way bytes enter: multipart, one file in the "file" field, streamed to storage. Never inline JSON. */
  @Post()
  @HarnessAccess('records:write')
  @UseGuards(UploadRoleGuard)
  @UseInterceptors(FileInterceptor('file'))
  upload(@Crm() ctx: RequestContext, @UploadedFile() file: Partial<StoredUpload> | undefined) {
    return this.files.register(ctx, file);
  }

  @Get(':id')
  @HarnessAccess('records:read')
  get(@Crm() ctx: RequestContext, @Param('id') id: string) {
    return this.files.get(ctx, id);
  }

  @Get(':id/content')
  @HarnessAccess('records:read')
  async content(@Crm() ctx: RequestContext, @Param('id') id: string, @Res({ passthrough: true }) res: HttpResponse) {
    const { file, stream } = await this.files.open(ctx, id);
    // Only plain images and PDFs render inline; everything else downloads, and nothing is sniffed.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    return new StreamableFile(stream, {
      type: file.media_type,
      length: file.size,
      disposition: disposition(INLINE_TYPES.has(file.media_type) ? 'inline' : 'attachment', file.filename),
    });
  }

  @Delete(':id')
  @HttpCode(204)
  @HarnessAccess('records:write')
  async remove(@Crm() ctx: RequestContext, @Param('id') id: string) {
    await this.files.remove(ctx, id);
  }
}
