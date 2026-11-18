import { Injectable } from '@nestjs/common';
import * as z from 'zod';
import type { RecordShare } from '../generated/prisma/client';
import type { RequestContext } from './context';
import { notFound, parse, validationFailed } from './errors';
import { idField } from './ids';
import { assertCan } from './permissions';
import { RecordsService, toId } from './records.service';
import { SchemaService } from './schema.service';

const id = idField;

const shareBody = z
  .object({ user_id: id.optional(), team_id: id.optional(), access: z.enum(['READ', 'WRITE']) })
  .refine((b) => (b.user_id === undefined) !== (b.team_id === undefined), 'Share with exactly one of user_id or team_id');

const dto = (s: RecordShare) => ({
  id: String(s.id),
  record_id: String(s.recordId),
  user_id: s.userId === null ? null : String(s.userId),
  team_id: s.teamId === null ? null : String(s.teamId),
  access: s.access,
  created_by: s.createdBy === null ? null : String(s.createdBy),
  created_at: s.createdAt.toISOString(),
});

@Injectable()
export class SharesService {
  constructor(
    private readonly records: RecordsService,
    private readonly schema: SchemaService,
  ) {}

  async list(ctx: RequestContext, objectName: string, rawId: string) {
    assertCan(ctx, { record: ['read'] }, 'view records');
    const recordId = toId(rawId, objectName);
    return this.records.tenant(ctx, async (tx) => {
      const object = await this.schema.loadObject(tx, ctx, objectName);
      await this.records.loadFor(tx, ctx, object, recordId, 'read');
      const rows = await tx.recordShare.findMany({
        where: { organizationId: ctx.organizationId, recordId },
        orderBy: { id: 'asc' },
      });
      return { results: rows.map(dto) };
    });
  }

  /** Share a record you can change with a user or a team, on top of the usual scopes. */
  async add(ctx: RequestContext, objectName: string, rawId: string, body: unknown) {
    assertCan(ctx, { record: ['update'] }, 'share records');
    const recordId = toId(rawId, objectName);
    const input = parse(shareBody, body);

    return this.records.tenant(ctx, async (tx) => {
      const object = await this.schema.loadObject(tx, ctx, objectName);
      await this.records.loadFor(tx, ctx, object, recordId, 'write');
      let share: RecordShare;
      try {
        share = await tx.recordShare.create({
          data: {
            organizationId: ctx.organizationId,
            recordId,
            userId: input.user_id ?? null,
            teamId: input.team_id ?? null,
            access: input.access,
            createdBy: ctx.userId,
          },
        });
      } catch (error) {
        if ((error as { code?: string }).code === 'P2003') {
          const field = input.user_id === undefined ? 'team_id' : 'user_id';
          throw validationFailed([
            {
              field,
              code: 'INVALID_FIELD',
              message: field === 'user_id' ? 'That user is not a member of this organization' : 'That team does not belong to this organization',
            },
          ]);
        }
        throw error;
      }
      await this.records.logChange(tx, ctx, object, recordId, 'UPDATE', {
        shared_with: { old: null, new: `${input.user_id === undefined ? 'team' : 'user'}:${input.user_id ?? input.team_id}:${input.access}` },
      });
      return dto(share);
    });
  }

  async remove(ctx: RequestContext, objectName: string, rawId: string, rawShareId: string) {
    assertCan(ctx, { record: ['update'] }, 'share records');
    const recordId = toId(rawId, objectName);
    const shareId = toId(rawShareId, 'share');
    return this.records.tenant(ctx, async (tx) => {
      const object = await this.schema.loadObject(tx, ctx, objectName);
      await this.records.loadFor(tx, ctx, object, recordId, 'write');
      const share = await tx.recordShare.findFirst({ where: { id: shareId, organizationId: ctx.organizationId, recordId } });
      if (!share) {
        throw notFound('No such share');
      }
      await tx.recordShare.delete({ where: { id: shareId } });
      await this.records.logChange(tx, ctx, object, recordId, 'UPDATE', {
        shared_with: { old: `${share.userId === null ? 'team' : 'user'}:${share.userId ?? share.teamId}:${share.access}`, new: null },
      });
      return { id: String(shareId), deleted: true };
    });
  }
}
