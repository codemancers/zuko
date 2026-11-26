import { Injectable } from '@nestjs/common';
import * as z from 'zod';
import { Prisma, type ObjectRecord } from '../generated/prisma/client';
import { PrismaService, type TenantTransaction } from '../prisma/prisma.service';
import type { RequestContext } from './context';
import { forbidden, notFound, parse, validationFailed, type FieldError } from './errors';
import { idField, parseId } from './ids';
import { validateProperties } from './field-types';
import { assertCan, resolveScopes, visibilitySql, type Mode, type Scope } from './permissions';
import { SchemaService, type ObjectWithFields } from './schema.service';

type Props = Record<string, unknown>;

const id = idField;

const createBody = z.object({
  properties: z.record(z.string(), z.unknown()).default({}),
  owner_id: id.nullable().optional(),
  team_id: id.nullable().optional(),
});

const updateBody = z
  .object({
    properties: z.record(z.string(), z.unknown()).optional(),
    owner_id: id.nullable().optional(),
    team_id: id.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

export const toId = (raw: string, what = 'record'): bigint => {
  const id = parseId(raw);
  if (id === undefined) {
    throw notFound(`No such ${what}`);
  }
  return id;
};

/** Only the values of the object's current fields: a removed field's values stay stored, unseen. */
const liveProperties = (object: ObjectWithFields, properties: unknown) => {
  const live = new Set(object.fields.map((f) => f.name));
  return Object.fromEntries(Object.entries((properties ?? {}) as Props).filter(([key]) => live.has(key)));
};

export const recordDto = (object: ObjectWithFields, r: ObjectRecord) => ({
  id: String(r.id),
  object: object.slug,
  properties: liveProperties(object, r.properties),
  owner_id: r.ownerId === null ? null : String(r.ownerId),
  team_id: r.teamId === null ? null : String(r.teamId),
  created_by: r.createdBy === null ? null : String(r.createdBy),
  created_at: r.createdAt.toISOString(),
  updated_at: r.updatedAt.toISOString(),
});

type Change = { old: unknown; new: unknown };

/** old -> new for every key whose value differs; sensitive fields are never copied into history. */
function diff(object: ObjectWithFields, before: Props, after: Props): Record<string, Change> {
  // A removed field's values stay stored, and the history is append-only, so what was sensitive stays so.
  const sensitive = new Set([...object.fields, ...object.removedFields].filter((f) => f.sensitive).map((f) => f.name));
  const changes: Record<string, Change> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key] ?? null;
    const b = after[key] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes[key] = sensitive.has(key) ? { old: '[redacted]', new: '[redacted]' } : { old: a, new: b };
    }
  }
  return changes;
}

@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schema: SchemaService,
  ) {}

  tenant<T>(ctx: RequestContext, fn: (tx: TenantTransaction) => Promise<T>) {
    return this.prisma.withTenant({ organizationId: ctx.organizationId, actorId: ctx.userId }, fn);
  }

  /**
   * Take the record's row lock for the rest of the transaction. A change reads the record's properties,
   * merges its own values in and writes the whole blob back, so two requests changing different fields
   * at once would otherwise both start from the same copy and the later write would undo the earlier.
   * With the lock the second waits, then reads what the first wrote.
   */
  private async lockRecord(tx: TenantTransaction, ctx: RequestContext, recordId: bigint) {
    await tx.$queryRaw`SELECT 1 FROM object_record WHERE "id" = ${recordId} AND "organizationId" = ${ctx.organizationId} FOR UPDATE`;
  }

  /** The live record, or 404. Does not check who may see it. */
  async findLive(tx: TenantTransaction, ctx: RequestContext, object: ObjectWithFields, recordId: bigint) {
    const row = await tx.objectRecord.findFirst({
      where: { id: recordId, organizationId: ctx.organizationId, objectTypeId: object.id, deletedAt: null },
    });
    if (!row) {
      throw notFound(`No such ${object.slug}`);
    }
    return row;
  }

  async canTouch(tx: TenantTransaction, ctx: RequestContext, object: ObjectWithFields, recordId: bigint, mode: Mode) {
    const scopes = await resolveScopes(tx, ctx, object.id, mode);
    const rows = await tx.$queryRaw<{ ok: number }[]>(Prisma.sql`
      SELECT 1 AS ok FROM object_record r
      WHERE r."id" = ${recordId} AND r."organizationId" = ${ctx.organizationId} AND r."deletedAt" IS NULL
        AND ${visibilitySql(ctx, scopes, mode)}`);
    return rows.length > 0;
  }

  /** Load a record the caller may read (404 otherwise, so existence is not leaked) and, for writes, may change (403). */
  async loadFor(tx: TenantTransaction, ctx: RequestContext, object: ObjectWithFields, recordId: bigint, mode: Mode) {
    const row = await this.findLive(tx, ctx, object, recordId);
    if (!(await this.canTouch(tx, ctx, object, recordId, 'read'))) {
      throw notFound(`No such ${object.slug}`);
    }
    if (mode === 'write' && !(await this.canTouch(tx, ctx, object, recordId, 'write'))) {
      throw forbidden('You are not allowed to change this record');
    }
    return row;
  }

  /** Unique fields must not repeat among live records (case-insensitive). Serialized per field. */
  private async assertUnique(tx: TenantTransaction, ctx: RequestContext, object: ObjectWithFields, values: Props, selfId: bigint | null) {
    const errors: FieldError[] = [];
    for (const field of object.fields.filter((f) => f.isUnique && values[f.name] !== undefined)) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${ctx.organizationId}:${object.id}:${field.name}`}))`;
      const taken = await tx.$queryRaw<{ id: bigint }[]>`
        SELECT "id" FROM object_record
        WHERE "organizationId" = ${ctx.organizationId} AND "objectTypeId" = ${object.id} AND "deletedAt" IS NULL
          AND lower("properties"->>${field.name}) = lower(${String(values[field.name])})
          AND (${selfId}::bigint IS NULL OR "id" <> ${selfId}::bigint)
        LIMIT 1`;
      if (taken.length > 0) {
        const error: FieldError = { field: field.name, code: 'DUPLICATE_VALUE', message: `Field '${field.name}' must be unique; that value is already in use` };
        // Name the record so the caller can use it instead, but only to someone who may read it.
        if (await this.canTouch(tx, ctx, object, taken[0].id, 'read')) {
          error.existing_id = String(taken[0].id);
        }
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw validationFailed(errors);
    }
  }

  /** A user field must name members of this organization. */
  private async assertMembers(tx: TenantTransaction, ctx: RequestContext, object: ObjectWithFields, values: Props) {
    const errors: FieldError[] = [];
    for (const field of object.fields.filter((f) => f.type === 'USER' && values[f.name] !== undefined)) {
      const ids = [...new Set([values[field.name]].flat().map((id) => BigInt(String(id))))];
      const found = await tx.member.count({ where: { organizationId: ctx.organizationId, userId: { in: ids } } });
      if (found !== ids.length) {
        errors.push({ field: field.name, code: 'INVALID_FIELD', message: `Field '${field.name}' must name members of this organization` });
      }
    }
    if (errors.length > 0) {
      throw validationFailed(errors);
    }
  }

  /** Who a record may be given to: the write scope decides how far beyond yourself you can reach. */
  private async assertAssignable(
    tx: TenantTransaction,
    ctx: RequestContext,
    scopes: ReadonlySet<Scope>,
    ownerId: bigint | null,
    teamId: bigint | null,
  ) {
    if (ownerId !== null) {
      const member = await tx.member.findFirst({ where: { organizationId: ctx.organizationId, userId: ownerId } });
      if (!member) {
        throw validationFailed([{ field: 'owner_id', code: 'INVALID_FIELD', message: 'The owner must be a member of this organization' }]);
      }
    }
    if (scopes.has('ALL')) {
      return;
    }
    let ok = ownerId === ctx.userId;
    if (!ok && ownerId !== null && scopes.has('OWN_AND_REPORTS')) {
      ok =
        (await tx.memberHierarchy.findFirst({
          where: { organizationId: ctx.organizationId, ancestorId: ctx.userId, descendantId: ownerId },
        })) !== null;
    }
    if (!ok && scopes.has('TEAM') && teamId !== null && ctx.teamIds.includes(teamId)) {
      ok = true;
    }
    if (teamId !== null && !ctx.teamIds.includes(teamId)) {
      ok = false;
    }
    if (!ok) {
      throw forbidden('You are not allowed to assign this record to that owner or team');
    }
  }

  logChange(tx: TenantTransaction, ctx: RequestContext, object: ObjectWithFields, recordId: bigint, action: 'CREATE' | 'UPDATE' | 'DELETE', changes: Record<string, Change>) {
    return tx.recordChange.create({
      data: {
        organizationId: ctx.organizationId,
        recordId,
        objectTypeId: object.id,
        action,
        changes: changes as unknown as Prisma.InputJsonObject,
        actorType: ctx.actorType,
        actorId: ctx.userId,
        requestId: ctx.requestId,
      },
    });
  }

  async create(ctx: RequestContext, objectName: string, body: unknown) {
    assertCan(ctx, { record: ['create'] }, 'create records');
    const input = parse(createBody, body);

    return this.tenant(ctx, async (tx) => {
      const object = await this.schema.loadObject(tx, ctx, objectName);
      const { set, errors } = validateProperties(object.fields, input.properties, 'create');
      if (errors.length > 0) {
        throw validationFailed(errors);
      }
      await this.assertUnique(tx, ctx, object, set, null);
      await this.assertMembers(tx, ctx, object, set);

      const ownerId = input.owner_id === undefined ? ctx.userId : input.owner_id;
      const teamId = input.team_id ?? null;
      await this.assertAssignable(tx, ctx, await resolveScopes(tx, ctx, object.id, 'write'), ownerId, teamId);

      const created = await tx.objectRecord.create({
        data: {
          organizationId: ctx.organizationId,
          objectTypeId: object.id,
          properties: set as Prisma.InputJsonObject,
          ownerId,
          teamId,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      });
      await this.logChange(tx, ctx, object, created.id, 'CREATE', {
        ...diff(object, {}, set),
        ...(ownerId === null ? {} : { owner_id: { old: null, new: String(ownerId) } }),
        ...(teamId === null ? {} : { team_id: { old: null, new: String(teamId) } }),
      });
      return recordDto(object, created);
    });
  }

  async get(ctx: RequestContext, objectName: string, rawId: string) {
    assertCan(ctx, { record: ['read'] }, 'view records');
    const recordId = toId(rawId, objectName);
    return this.tenant(ctx, async (tx) => {
      const object = await this.schema.loadObject(tx, ctx, objectName);
      return recordDto(object, await this.loadFor(tx, ctx, object, recordId, 'read'));
    });
  }

  async update(ctx: RequestContext, objectName: string, rawId: string, body: unknown) {
    assertCan(ctx, { record: ['update'] }, 'update records');
    const recordId = toId(rawId, objectName);
    const input = parse(updateBody, body);

    return this.tenant(ctx, async (tx) => {
      const object = await this.schema.loadObject(tx, ctx, objectName);
      await this.lockRecord(tx, ctx, recordId);
      const row = await this.loadFor(tx, ctx, object, recordId, 'write');

      const { set, clear, errors } = validateProperties(object.fields, input.properties ?? {}, 'update');
      if (errors.length > 0) {
        throw validationFailed(errors);
      }
      await this.assertUnique(tx, ctx, object, set, recordId);
      await this.assertMembers(tx, ctx, object, set);

      const before = row.properties as Props;
      const after: Props = { ...before, ...set };
      for (const name of clear) {
        delete after[name];
      }
      const ownerId = input.owner_id === undefined ? row.ownerId : input.owner_id;
      const teamId = input.team_id === undefined ? row.teamId : input.team_id;
      const reassigned = ownerId !== row.ownerId || teamId !== row.teamId;
      if (reassigned) {
        await this.assertAssignable(tx, ctx, await resolveScopes(tx, ctx, object.id, 'write'), ownerId, teamId);
      }

      const changes: Record<string, Change> = {
        ...diff(object, before, after),
        ...(ownerId === row.ownerId ? {} : { owner_id: { old: row.ownerId === null ? null : String(row.ownerId), new: ownerId === null ? null : String(ownerId) } }),
        ...(teamId === row.teamId ? {} : { team_id: { old: row.teamId === null ? null : String(row.teamId), new: teamId === null ? null : String(teamId) } }),
      };
      if (Object.keys(changes).length === 0) {
        return recordDto(object, row);
      }
      const updated = await tx.objectRecord.update({
        where: { id: recordId },
        data: { properties: after as Prisma.InputJsonObject, ownerId, teamId, updatedBy: ctx.userId },
      });
      await this.logChange(tx, ctx, object, recordId, 'UPDATE', changes);
      return recordDto(object, updated);
    });
  }

  /** Soft delete: the row stays (with its history) but is no longer listed or readable. */
  async remove(ctx: RequestContext, objectName: string, rawId: string) {
    assertCan(ctx, { record: ['delete'] }, 'delete records');
    const recordId = toId(rawId, objectName);
    return this.tenant(ctx, async (tx) => {
      const object = await this.schema.loadObject(tx, ctx, objectName);
      await this.lockRecord(tx, ctx, recordId);
      const row = await this.loadFor(tx, ctx, object, recordId, 'write');
      await tx.objectRecord.update({ where: { id: recordId }, data: { deletedAt: new Date(), updatedBy: ctx.userId } });
      await this.logChange(tx, ctx, object, recordId, 'DELETE', diff(object, row.properties as Props, {}));
      return { id: String(recordId), deleted: true };
    });
  }

  async history(ctx: RequestContext, objectName: string, rawId: string) {
    assertCan(ctx, { record: ['read'] }, 'view records');
    const recordId = toId(rawId, objectName);
    return this.tenant(ctx, async (tx) => {
      const object = await this.schema.loadObject(tx, ctx, objectName);
      await this.loadFor(tx, ctx, object, recordId, 'read');
      const rows = await tx.recordChange.findMany({
        where: { organizationId: ctx.organizationId, recordId },
        orderBy: { id: 'desc' },
        take: 200,
      });
      return {
        results: rows.map((c) => ({
          id: String(c.id),
          action: c.action,
          changes: c.changes,
          actor_type: c.actorType,
          actor_id: c.actorId === null ? null : String(c.actorId),
          request_id: c.requestId,
          created_at: c.createdAt.toISOString(),
        })),
      };
    });
  }
}
