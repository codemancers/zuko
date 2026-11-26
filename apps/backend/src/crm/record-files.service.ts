import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { TenantTransaction } from '../prisma/prisma.service';
import type { RequestContext } from './context';
import { validationFailed, type FieldError } from './errors';
import { holdsMany, type FieldDef } from './field-types';
import { can, resolveScopes, visibilitySql } from './permissions';
import type { ObjectWithFields } from './schema.service';

/** What a record read shows for an attached file. */
export interface AttachedFile {
  id: string;
  filename: string;
  media_type: string;
  size: number;
}

/** A FILE field's value as stored: one id, or a list for a field that holds many. */
export type FileValue = string | string[] | null;

const isFile = (f: Pick<FieldDef, 'type'>) => f.type === 'FILE';

/**
 * Where files are attached (record_file for FILE fields, comment_file for comments) and who may read a
 * file. A file is readable to its uploader, and to anyone who can read a live record it is attached to,
 * through a live FILE field or a live comment. So attaching a file shares it with that record's readers.
 */
@Injectable()
export class RecordFilesService {
  /** The ids a FILE field holds on each record, in order. */
  async idsFor(tx: TenantTransaction, ctx: RequestContext, object: ObjectWithFields, recordIds: bigint[]) {
    const names = object.fields.filter(isFile).map((f) => f.name);
    const result = new Map<bigint, Map<string, bigint[]>>();
    if (names.length === 0 || recordIds.length === 0) return result;
    const rows = await tx.recordFile.findMany({
      where: { organizationId: ctx.organizationId, recordId: { in: recordIds }, fieldName: { in: names }, file: { deletedAt: null } },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { recordId: true, fieldName: true, fileId: true },
    });
    for (const row of rows) {
      const byField = result.get(row.recordId) ?? new Map<string, bigint[]>();
      byField.set(row.fieldName, [...(byField.get(row.fieldName) ?? []), row.fileId]);
      result.set(row.recordId, byField);
    }
    return result;
  }

  /** For each record, each FILE field's value as a read shows it: one descriptor, or a list. */
  async valuesFor(tx: TenantTransaction, ctx: RequestContext, object: ObjectWithFields, recordIds: bigint[]) {
    const ids = await this.idsFor(tx, ctx, object, recordIds);
    const all = [...new Set([...ids.values()].flatMap((byField) => [...byField.values()].flat()))];
    const files = all.length
      ? await tx.storedFile.findMany({ where: { organizationId: ctx.organizationId, id: { in: all }, deletedAt: null } })
      : [];
    const byId = new Map(files.map((f) => [f.id, f]));
    const describe = (id: bigint): AttachedFile[] => {
      const f = byId.get(id);
      return f ? [{ id: String(f.id), filename: f.filename, media_type: f.mediaType, size: f.size }] : [];
    };
    const out = new Map<bigint, Record<string, AttachedFile | AttachedFile[]>>();
    for (const [recordId, byField] of ids) {
      const values: Record<string, AttachedFile | AttachedFile[]> = {};
      for (const field of object.fields.filter(isFile)) {
        const list = (byField.get(field.name) ?? []).flatMap(describe);
        if (holdsMany(field)) values[field.name] = list;
        else if (list[0]) values[field.name] = list[0];
      }
      out.set(recordId, values);
    }
    return out;
  }

  /** The value of each FILE field as history records it: ids, never names. */
  async valueOf(tx: TenantTransaction, ctx: RequestContext, object: ObjectWithFields, recordId: bigint) {
    const byField = (await this.idsFor(tx, ctx, object, [recordId])).get(recordId);
    const out: Record<string, FileValue> = {};
    for (const field of object.fields.filter(isFile)) {
      const ids = (byField?.get(field.name) ?? []).map(String);
      out[field.name] = holdsMany(field) ? (ids.length ? ids : null) : (ids[0] ?? null);
    }
    return out;
  }

  /** Replace what one FILE field holds on a record. `null` or an empty list detaches everything. */
  async set(tx: TenantTransaction, ctx: RequestContext, recordId: bigint, fieldName: string, value: FileValue) {
    const ids = (value === null ? [] : [value].flat()).map((id) => BigInt(id));
    await tx.recordFile.deleteMany({
      where: { organizationId: ctx.organizationId, recordId, fieldName, ...(ids.length ? { fileId: { notIn: ids } } : {}) },
    });
    for (const [position, fileId] of ids.entries()) {
      await tx.recordFile.upsert({
        where: { recordId_fieldName_fileId: { recordId, fieldName, fileId } },
        create: { organizationId: ctx.organizationId, recordId, fieldName, fileId, position, createdBy: ctx.userId },
        update: { position },
      });
    }
  }

  /**
   * The files among `ids` the caller may read: ones they uploaded, and ones attached to a record they can
   * read. Deleted files and other organizations' files are never in the result.
   */
  async readable(tx: TenantTransaction, ctx: RequestContext, ids: bigint[]): Promise<Set<bigint>> {
    if (ids.length === 0) return new Set();
    const live = await tx.storedFile.findMany({
      where: { organizationId: ctx.organizationId, id: { in: ids }, deletedAt: null },
      select: { id: true, uploadedBy: true },
    });
    const readable = new Set(live.filter((f) => f.uploadedBy === ctx.userId).map((f) => f.id));
    const rest = live.map((f) => f.id).filter((id) => !readable.has(id));
    if (rest.length === 0 || !can(ctx, { record: ['read'] })) return readable;

    const links = await tx.$queryRaw<{ fileId: bigint; recordId: bigint; objectTypeId: bigint }[]>(Prisma.sql`
      SELECT rf."file_id" AS "fileId", rf."record_id" AS "recordId", r."object_type_id" AS "objectTypeId"
      FROM record_file rf
      JOIN object_record r ON r."organization_id" = rf."organization_id" AND r."id" = rf."record_id" AND r."deleted_at" IS NULL
      JOIN field_definition fd ON fd."object_type_id" = r."object_type_id" AND fd."name" = rf."field_name"
        AND fd."type" = 'FILE' AND fd."deleted_at" IS NULL
      WHERE rf."organization_id" = ${ctx.organizationId} AND rf."file_id" IN (${Prisma.join(rest)})
      UNION ALL
      SELECT cf."file_id" AS "fileId", c."record_id" AS "recordId", c."object_type_id" AS "objectTypeId"
      FROM comment_file cf
      JOIN record_comment c ON c."organization_id" = cf."organization_id" AND c."id" = cf."comment_id" AND c."deleted_at" IS NULL
      JOIN object_record r ON r."organization_id" = c."organization_id" AND r."id" = c."record_id" AND r."deleted_at" IS NULL
      WHERE cf."organization_id" = ${ctx.organizationId} AND cf."file_id" IN (${Prisma.join(rest)})`);
    const byType = new Map<bigint, bigint[]>();
    for (const link of links) byType.set(link.objectTypeId, [...(byType.get(link.objectTypeId) ?? []), link.recordId]);
    for (const [objectTypeId, recordIds] of byType) {
      const scopes = await resolveScopes(tx, ctx, objectTypeId, 'read');
      const visible = new Set(
        (
          await tx.$queryRaw<{ id: bigint }[]>(Prisma.sql`
            SELECT r."id" FROM object_record r
            WHERE r."organization_id" = ${ctx.organizationId} AND r."id" IN (${Prisma.join(recordIds)})
              AND ${visibilitySql(ctx, scopes, 'read')}`)
        ).map((row) => row.id),
      );
      for (const link of links) {
        if (link.objectTypeId === objectTypeId && visible.has(link.recordId)) readable.add(link.fileId);
      }
    }
    return readable;
  }

  /** How many live records and comments hold a file, whoever may read them. */
  async attachmentCount(tx: TenantTransaction, ctx: RequestContext, fileId: bigint) {
    const rows = await tx.$queryRaw<{ n: bigint }[]>(Prisma.sql`
      SELECT count(*) AS n FROM record_file rf
      JOIN object_record r ON r."organization_id" = rf."organization_id" AND r."id" = rf."record_id" AND r."deleted_at" IS NULL
      JOIN field_definition fd ON fd."object_type_id" = r."object_type_id" AND fd."name" = rf."field_name"
        AND fd."type" = 'FILE' AND fd."deleted_at" IS NULL
      WHERE rf."organization_id" = ${ctx.organizationId} AND rf."file_id" = ${fileId}`);
    const onComments = await tx.$queryRaw<{ n: bigint }[]>(Prisma.sql`
      SELECT count(*) AS n FROM comment_file cf
      JOIN record_comment c ON c."organization_id" = cf."organization_id" AND c."id" = cf."comment_id" AND c."deleted_at" IS NULL
      JOIN object_record r ON r."organization_id" = c."organization_id" AND r."id" = c."record_id" AND r."deleted_at" IS NULL
      WHERE cf."organization_id" = ${ctx.organizationId} AND cf."file_id" = ${fileId}`);
    return Number(rows[0]?.n ?? 0) + Number(onComments[0]?.n ?? 0);
  }

  /**
   * Lock files for the rest of the transaction, so deleting a file and attaching it cannot both succeed.
   * Attaching takes a shared lock (many may attach at once) and deleting an exclusive one, so whichever
   * comes second waits for the first to commit and then sees its result: a delete finds the attachment and
   * is refused, an attach finds the file gone and is refused. Locked in id order, so two writers naming
   * several of the same files cannot deadlock.
   */
  async lockFiles(tx: TenantTransaction, ctx: RequestContext, ids: bigint[], mode: 'attach' | 'delete') {
    if (ids.length === 0) return;
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM stored_file
      WHERE "organization_id" = ${ctx.organizationId} AND "id" IN (${Prisma.join(ids)})
      ORDER BY "id" ${mode === 'delete' ? Prisma.sql`FOR UPDATE` : Prisma.sql`FOR SHARE`}`);
  }

  /**
   * A file field (or `files` list) may only name files the caller can read: their own uploads, and
   * files attached to something they can read. Reports the first field that does not.
   */
  async assertAttachable(tx: TenantTransaction, ctx: RequestContext, wanted: Map<string, string[]>) {
    const all = [...new Set([...wanted.values()].flat())].map((id) => BigInt(id));
    if (all.length === 0) return;
    // Held until the caller's transaction ends, which is after the attachment is written.
    await this.lockFiles(tx, ctx, all, 'attach');
    const readable = await this.readable(tx, ctx, all);
    const errors: FieldError[] = [];
    for (const [name, ids] of wanted) {
      if (ids.some((id) => !readable.has(BigInt(id)))) {
        errors.push({ field: name, code: 'INVALID_FIELD', message: `Field '${name}' names a file that does not exist or that you cannot access` });
      }
    }
    if (errors.length > 0) throw validationFailed(errors);
  }

  /** The files on each comment, in order. */
  async commentValues(tx: TenantTransaction, ctx: RequestContext, commentIds: bigint[]) {
    const out = new Map<bigint, AttachedFile[]>();
    if (commentIds.length === 0) return out;
    const rows = await tx.commentFile.findMany({
      where: { organizationId: ctx.organizationId, commentId: { in: commentIds }, file: { deletedAt: null } },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      include: { file: true },
    });
    for (const { commentId, file } of rows) {
      out.set(commentId, [...(out.get(commentId) ?? []), { id: String(file.id), filename: file.filename, media_type: file.mediaType, size: file.size }]);
    }
    return out;
  }

  /** Replace the files on a comment. */
  async setCommentFiles(tx: TenantTransaction, ctx: RequestContext, commentId: bigint, ids: string[]) {
    const fileIds = ids.map((id) => BigInt(id));
    await tx.commentFile.deleteMany({
      where: { organizationId: ctx.organizationId, commentId, ...(fileIds.length ? { fileId: { notIn: fileIds } } : {}) },
    });
    for (const [position, fileId] of fileIds.entries()) {
      await tx.commentFile.upsert({
        where: { commentId_fileId: { commentId, fileId } },
        create: { organizationId: ctx.organizationId, commentId, fileId, position },
        update: { position },
      });
    }
  }

  /**
   * Every file attached to a record, newest first, with where it came from: a FILE field, or a comment.
   * The caller must already be allowed to read the record, which is what makes each file readable.
   */
  async listForRecord(tx: TenantTransaction, ctx: RequestContext, object: ObjectWithFields, recordId: bigint, limit: number) {
    const fields = object.fields.filter(isFile);
    const [onFields, onComments] = await Promise.all([
      fields.length
        ? tx.recordFile.findMany({
            where: { organizationId: ctx.organizationId, recordId, fieldName: { in: fields.map((f) => f.name) }, file: { deletedAt: null } },
            include: { file: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit,
          })
        : [],
      tx.commentFile.findMany({
        where: { organizationId: ctx.organizationId, comment: { recordId, deletedAt: null }, file: { deletedAt: null } },
        include: { file: true, comment: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
    ]);
    const labels = new Map(fields.map((f) => [f.name, f.label]));
    const items = [
      ...onFields.map((row) => ({
        at: row.createdAt,
        file: row.file,
        by: row.createdBy,
        actorType: null as string | null,
        source: { type: 'field' as const, field: row.fieldName, label: labels.get(row.fieldName) ?? row.fieldName },
      })),
      ...onComments.map((row) => ({
        at: row.createdAt,
        file: row.file,
        by: row.comment.authorId,
        actorType: row.comment.actorType as string | null,
        source: { type: 'comment' as const, comment_id: String(row.commentId) },
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, limit);
    const ids = [...new Set(items.flatMap((i) => (i.by === null ? [] : [i.by])))];
    const users = ids.length ? await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const names = new Map(users.map((u) => [u.id, u.name]));
    return items.map((i) => ({
      file: { id: String(i.file.id), filename: i.file.filename, media_type: i.file.mediaType, size: i.file.size },
      source: i.source,
      attached_at: i.at.toISOString(),
      attached_by: i.by === null ? null : { id: String(i.by), name: names.get(i.by) ?? null },
      actor_type: i.actorType,
    }));
  }
}
