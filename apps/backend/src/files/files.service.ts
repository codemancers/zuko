import { Inject, Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { badRequest, conflict, notFound } from '../crm/errors';
import type { RequestContext } from '../crm/context';
import { RecordFilesService } from '../crm/record-files.service';
import { parseId } from '../crm/ids';
import { assertCanUploadFiles } from '../crm/permissions';
import { PrismaService, type TenantTransaction } from '../prisma/prisma.service';
import type { StoredFile } from '../generated/prisma/client';
import { detectMediaType, safeFilename } from './file-types';
import type { StoredUpload } from './multer-storage';
import { FILE_STORAGE, type FileStorage } from './storage';

/** A file as the API reports it. Ids are strings; the storage key never leaves the server. */
export interface FileDescriptor {
  id: string;
  filename: string;
  media_type: string;
  size: number;
  uploaded_by: string | null;
  created_at: string;
}

const describe = (f: StoredFile): FileDescriptor => ({
  id: String(f.id),
  filename: f.filename,
  media_type: f.mediaType,
  size: f.size,
  uploaded_by: f.uploadedBy === null ? null : String(f.uploadedBy),
  created_at: f.createdAt.toISOString(),
});

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly attachments: RecordFilesService,
  ) {}

  /**
   * Who may read a file: its uploader, or anyone who can read a live record it is attached to (see
   * RecordFilesService.readable). Anything else is reported as missing, never as forbidden.
   */
  private async visible(tx: TenantTransaction, ctx: RequestContext, rawId: string): Promise<StoredFile> {
    const id = parseId(rawId);
    if (id === undefined || !(await this.attachments.readable(tx, ctx, [id])).has(id)) throw notFound('File not found');
    const file = await tx.storedFile.findFirst({ where: { id, organizationId: ctx.organizationId, deletedAt: null } });
    if (!file) throw notFound('File not found');
    return file;
  }

  private audit(ctx: RequestContext, event: string, fileId: bigint, metadata: Record<string, unknown>) {
    return this.prisma.auditEvent.create({
      data: { organizationId: ctx.organizationId, actorType: ctx.actorType, actorId: ctx.userId, event, targetType: 'file', targetId: fileId, metadata: metadata as object, requestId: ctx.requestId },
    });
  }

  /** Record a file whose bytes multer already streamed to storage. Removes the bytes if the row can't be written. */
  async register(ctx: RequestContext, upload: (Partial<StoredUpload> & { originalname?: string; mimetype?: string }) | undefined): Promise<FileDescriptor> {
    if (!upload?.key || !upload.sha256) throw badRequest('NO_FILE', 'Send one file in the "file" field');
    try {
      assertCanUploadFiles(ctx);
      return await this.insert(ctx, { key: upload.key, size: upload.size ?? 0, sha256: upload.sha256 }, upload.originalname ?? '', upload.mimetype ?? '');
    } catch (error) {
      await this.storage.delete(upload.key).catch(() => undefined);
      throw error;
    }
  }

  private async insert(ctx: RequestContext, put: { key: string; size: number; sha256: string }, filename: string, declared: string) {
    if (put.size === 0) throw badRequest('EMPTY_FILE', 'The file is empty');
    const mediaType = await detectMediaType(await this.storage.get(put.key), declared);
    const file = await this.prisma.withTenant({ organizationId: ctx.organizationId, actorId: ctx.userId }, (tx) =>
      tx.storedFile.create({
        data: {
          organizationId: ctx.organizationId,
          uploadedBy: ctx.userId,
          filename: safeFilename(filename),
          mediaType,
          size: put.size,
          sha256: put.sha256,
          storageKey: put.key,
        },
      }),
    );
    await this.audit(ctx, 'file.uploaded', file.id, { filename: file.filename, size: file.size, media_type: file.mediaType });
    return describe(file);
  }

  async get(ctx: RequestContext, id: string): Promise<FileDescriptor> {
    return describe(await this.prisma.withTenant({ organizationId: ctx.organizationId, actorId: ctx.userId }, (tx) => this.visible(tx, ctx, id)));
  }

  async open(ctx: RequestContext, id: string): Promise<{ file: FileDescriptor; stream: Readable }> {
    const row = await this.prisma.withTenant({ organizationId: ctx.organizationId, actorId: ctx.userId }, (tx) => this.visible(tx, ctx, id));
    try {
      return { file: describe(row), stream: await this.storage.get(row.storageKey) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw notFound('File not found');
      throw error;
    }
  }

  /** Soft delete: the row is hidden at once; a cleanup job removes the bytes later. */
  async remove(ctx: RequestContext, id: string): Promise<void> {
    const file = await this.prisma.withTenant({ organizationId: ctx.organizationId, actorId: ctx.userId }, async (tx) => {
      // Lock first, so an attachment being written at this moment either commits before the count below or
      // waits for this delete and is then refused.
      const fileId = parseId(id);
      if (fileId !== undefined) await this.attachments.lockFiles(tx, ctx, [fileId], 'delete');
      const row = await this.visible(tx, ctx, id);
      // Only the uploader deletes a file, and only once no record holds it: detach it first.
      if (row.uploadedBy !== ctx.userId) throw notFound('File not found');
      const attached = await this.attachments.attachmentCount(tx, ctx, row.id);
      if (attached > 0) throw conflict(`This file is attached to ${attached} record${attached === 1 ? '' : 's'}; detach it first`);
      await tx.storedFile.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
      return row;
    });
    await this.audit(ctx, 'file.deleted', file.id, { filename: file.filename });
  }
}

