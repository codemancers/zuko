import { Injectable } from '@nestjs/common';
import * as z from 'zod';
import type { Prisma, RecordChange, RecordComment } from '../generated/prisma/client';
import type { TenantTransaction } from '../prisma/prisma.service';
import { CrmContextService, type RequestContext } from './context';
import { CrmError, forbidden, notFound, parse, validationFailed } from './errors';
import { idField } from './ids';
import { assertCan, can } from './permissions';
import { RecordsService, toId } from './records.service';
import { SchemaService, type ObjectWithFields } from './schema.service';

export const MAX_COMMENT_LENGTH = 10_000;
const MAX_MENTIONS = 20;
const DEFAULT_PAGE = 50;
const MAX_PAGE = 100;

const body = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1, 'A comment cannot be empty').max(MAX_COMMENT_LENGTH, `A comment is at most ${MAX_COMMENT_LENGTH} characters`));
const mentions = z.array(idField).max(MAX_MENTIONS, `At most ${MAX_MENTIONS} mentions`);

const createBody = z.object({ body, mentions: mentions.default([]) });
const updateBody = z
  .object({ body: body.optional(), mentions: mentions.optional() })
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update');
const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE).default(DEFAULT_PAGE),
  before: z.string().max(200).optional(),
});

type Kind = 'change' | 'comment';
/** Rows made in the same millisecond sort changes before comments, then by id. */
const RANK: Record<Kind, number> = { change: 0, comment: 1 };

interface Cursor {
  at: Date;
  kind: Kind;
  id: bigint;
}

const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify([c.at.toISOString(), c.kind, String(c.id)])).toString('base64url');

function decodeCursor(raw: string | undefined): Cursor | undefined {
  if (raw === undefined) {
    return undefined;
  }
  try {
    const [at, kind, id] = JSON.parse(Buffer.from(raw, 'base64url').toString()) as [string, string, string];
    const date = new Date(at);
    if ((kind === 'change' || kind === 'comment') && /^[1-9]\d{0,18}$/.test(id) && !Number.isNaN(date.getTime())) {
      return { at: date, kind, id: BigInt(id) };
    }
  } catch {
    // fall through
  }
  throw new CrmError(400, 'INVALID_CURSOR', "'before' must be a next_before value from an earlier response");
}

/** Rows of `kind` that sort strictly before the cursor. */
const beforeCursor = (kind: Kind, cursor: Cursor | undefined) =>
  cursor === undefined
    ? {}
    : {
        OR: [
          { createdAt: { lt: cursor.at } },
          {
            createdAt: cursor.at,
            ...(RANK[kind] < RANK[cursor.kind] ? {} : RANK[kind] > RANK[cursor.kind] ? { id: { lt: 0n } } : { id: { lt: cursor.id } }),
          },
        ],
      };

const idOrNull = (id: bigint | null) => (id === null ? null : String(id));

type Item =
  | { kind: 'change'; at: Date; id: bigint; row: RecordChange }
  | { kind: 'comment'; at: Date; id: bigint; row: RecordComment };

/** Newest first. */
const newestFirst = (a: Item, b: Item) =>
  b.at.getTime() - a.at.getTime() || RANK[b.kind] - RANK[a.kind] || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

@Injectable()
export class CommentsService {
  constructor(
    private readonly records: RecordsService,
    private readonly schema: SchemaService,
    private readonly contexts: CrmContextService,
  ) {}

  /**
   * Every named member must be able to read the record, or the comment would point them at
   * something they cannot open (and tell the commenter nothing they did not already know).
   */
  private async assertMentionable(
    tx: TenantTransaction,
    ctx: RequestContext,
    object: ObjectWithFields,
    recordId: bigint,
    ids: bigint[],
  ) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return unique;
    }
    const members = await tx.member.findMany({
      where: { organizationId: ctx.organizationId, userId: { in: unique } },
      select: { userId: true },
    });
    const found = new Set(members.map((m) => m.userId));
    const unknown = unique.filter((id) => !found.has(id));
    if (unknown.length > 0) {
      throw validationFailed([{ field: 'mentions', code: 'INVALID_FIELD', message: 'Mentions must name members of this organization' }]);
    }
    for (const userId of unique) {
      const them = userId === ctx.userId ? ctx : await this.contexts.build({ userId, organizationId: ctx.organizationId, actorType: 'USER' });
      if (!(await this.records.canTouch(tx, them, object, recordId, 'read'))) {
        throw validationFailed([
          { field: 'mentions', code: 'INVALID_FIELD', message: `Member ${userId} cannot see this ${object.slug}, so they cannot be mentioned` },
        ]);
      }
    }
    return unique;
  }

  private async actorNames(tx: TenantTransaction, ids: (bigint | null)[]) {
    const wanted = [...new Set(ids.filter((id): id is bigint => id !== null))];
    const users = wanted.length === 0 ? [] : await tx.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
    return new Map(users.map((u) => [u.id, u.name]));
  }

  private commentDto(row: RecordComment, names: Map<bigint, string>) {
    return {
      type: 'comment' as const,
      id: String(row.id),
      record_id: String(row.recordId),
      body: row.body,
      mentions: row.mentions.map(String),
      actor_type: row.actorType,
      actor_id: idOrNull(row.authorId),
      actor_name: row.authorId === null ? null : (names.get(row.authorId) ?? null),
      edited_at: row.editedAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
    };
  }

  private changeDto(row: RecordChange, names: Map<bigint, string>) {
    return {
      type: 'change' as const,
      id: String(row.id),
      record_id: String(row.recordId),
      action: row.action,
      changes: row.changes,
      actor_type: row.actorType,
      actor_id: idOrNull(row.actorId),
      actor_name: row.actorId === null ? null : (names.get(row.actorId) ?? null),
      created_at: row.createdAt.toISOString(),
    };
  }

  /**
   * The most recent `limit` items of the record's timeline, oldest first, and `next_before` to
   * read the ones before them. Each table is read newest-first with its own limit and the two are
   * merged, so a long history is never loaded whole.
   */
  private feed(ctx: RequestContext, objectName: string, rawId: string, query: unknown, kinds: Kind[]) {
    assertCan(ctx, { record: ['read'] }, 'view records');
    const recordId = toId(rawId, objectName);
    const { limit, before } = parse(pageQuery, query);
    const cursor = decodeCursor(before);

    return this.records.tenant(ctx, async (tx) => {
      const object = await this.schema.loadObject(tx, ctx, objectName);
      await this.records.loadFor(tx, ctx, object, recordId, 'read');
      const scope = { organizationId: ctx.organizationId, recordId };
      const [changes, comments] = await Promise.all([
        kinds.includes('change')
          ? tx.recordChange.findMany({
              where: { ...scope, ...beforeCursor('change', cursor) } as Prisma.RecordChangeWhereInput,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: limit + 1,
            })
          : [],
        kinds.includes('comment')
          ? tx.recordComment.findMany({
              where: { ...scope, deletedAt: null, ...beforeCursor('comment', cursor) } as Prisma.RecordCommentWhereInput,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: limit + 1,
            })
          : [],
      ]);
      const merged: Item[] = [
        ...changes.map((row): Item => ({ kind: 'change', at: row.createdAt, id: row.id, row })),
        ...comments.map((row): Item => ({ kind: 'comment', at: row.createdAt, id: row.id, row })),
      ].sort(newestFirst);
      const hasMore = merged.length > limit;
      const page = merged.slice(0, limit);
      const names = await this.actorNames(tx, page.map((i) => (i.kind === 'change' ? i.row.actorId : i.row.authorId)));
      const oldest = page[page.length - 1];
      return {
        results: page.reverse().map((i) => (i.kind === 'change' ? this.changeDto(i.row, names) : this.commentDto(i.row, names))),
        next_before: hasMore && oldest ? encodeCursor({ at: oldest.at, kind: oldest.kind, id: oldest.id }) : null,
      };
    });
  }

  /** Comments and changes together, the record's timeline. */
  activity(ctx: RequestContext, objectName: string, rawId: string, query: unknown) {
    return this.feed(ctx, objectName, rawId, query, ['change', 'comment']);
  }

  list(ctx: RequestContext, objectName: string, rawId: string, query: unknown) {
    return this.feed(ctx, objectName, rawId, query, ['comment']);
  }

  /** Anyone who can read the record may comment on it; they need not be able to change it. */
  async create(ctx: RequestContext, objectName: string, rawId: string, input: unknown) {
    assertCan(ctx, { record: ['read'], comment: ['create'] }, 'comment on records');
    const recordId = toId(rawId, objectName);
    const data = parse(createBody, input);

    return this.records.tenant(ctx, async (tx) => {
      const object = await this.schema.loadObject(tx, ctx, objectName);
      await this.records.loadFor(tx, ctx, object, recordId, 'read');
      const mentioned = await this.assertMentionable(tx, ctx, object, recordId, data.mentions);
      const row = await tx.recordComment.create({
        data: {
          organizationId: ctx.organizationId,
          recordId,
          objectTypeId: object.id,
          authorId: ctx.userId,
          actorType: ctx.actorType,
          body: data.body,
          mentions: mentioned,
        },
      });
      return this.commentDto(row, await this.actorNames(tx, [row.authorId]));
    });
  }

  /** A live comment on a record the caller can read; a missing one and an unreadable record look the same. */
  private async loadComment(tx: TenantTransaction, ctx: RequestContext, objectName: string, recordId: bigint, rawCommentId: string) {
    const object = await this.schema.loadObject(tx, ctx, objectName);
    await this.records.loadFor(tx, ctx, object, recordId, 'read');
    const row = await tx.recordComment.findFirst({
      where: { id: toId(rawCommentId, 'comment'), organizationId: ctx.organizationId, recordId, deletedAt: null },
    });
    if (!row) {
      throw notFound('No such comment');
    }
    return { object, row };
  }

  /** Only the author edits a comment, whoever else is allowed to remove it. */
  async update(ctx: RequestContext, objectName: string, rawId: string, rawCommentId: string, input: unknown) {
    assertCan(ctx, { record: ['read'], comment: ['create'] }, 'comment on records');
    const recordId = toId(rawId, objectName);
    const data = parse(updateBody, input);

    return this.records.tenant(ctx, async (tx) => {
      const { object, row } = await this.loadComment(tx, ctx, objectName, recordId, rawCommentId);
      if (row.authorId !== ctx.userId) {
        throw forbidden('You can only edit your own comments');
      }
      const mentioned = data.mentions === undefined ? undefined : await this.assertMentionable(tx, ctx, object, recordId, data.mentions);
      const changed = (data.body !== undefined && data.body !== row.body) || mentioned !== undefined;
      if (!changed) {
        return this.commentDto(row, await this.actorNames(tx, [row.authorId]));
      }
      const updated = await tx.recordComment.update({
        where: { id: row.id },
        data: { ...(data.body === undefined ? {} : { body: data.body }), ...(mentioned === undefined ? {} : { mentions: mentioned }), editedAt: new Date() },
      });
      return this.commentDto(updated, await this.actorNames(tx, [updated.authorId]));
    });
  }

  /** Soft delete: the author may remove their own comment, and owners and admins anyone's. */
  async remove(ctx: RequestContext, objectName: string, rawId: string, rawCommentId: string) {
    assertCan(ctx, { record: ['read'] }, 'view records');
    const recordId = toId(rawId, objectName);

    return this.records.tenant(ctx, async (tx) => {
      const { row } = await this.loadComment(tx, ctx, objectName, recordId, rawCommentId);
      if (row.authorId !== ctx.userId && !can(ctx, { comment: ['moderate'] })) {
        throw forbidden('You can only delete your own comments');
      }
      await tx.recordComment.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
      return { id: String(row.id), deleted: true };
    });
  }
}
