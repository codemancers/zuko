import { Injectable } from '@nestjs/common';
import * as z from 'zod';
import { Prisma } from '../generated/prisma/client';
import type { AssociationDefinition } from '../generated/prisma/client';
import type { TenantTransaction } from '../prisma/prisma.service';
import type { RequestContext } from './context';
import { forbidden, notFound, parse, validationFailed } from './errors';
import { assertCan, resolveScopes, visibilitySql } from './permissions';
import { RecordsService, toId } from './records.service';
import { SchemaService, type ObjectWithFields } from './schema.service';

const MAX_PAGE_SIZE = 100;
/** A row in the sheet shows this many linked records; the rest are a click away. */
const MAX_SUMMARY = 50;
const MAX_LINKS_PER_CALL = 500;

const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).default(20),
});
const replaceBody = z.object({ record_ids: z.array(z.string()).max(MAX_LINKS_PER_CALL) });
const linkBody = z.object({ record_id: z.string() });

type Properties = Record<string, unknown>;
export interface Linked {
  id: string;
  label: string;
}

/**
 * What a record is called when it is shown as a link: a person by their full name, anything
 * else by its first field.
 */
export function recordLabel(object: ObjectWithFields, id: bigint, properties: unknown): string {
  const props = (properties ?? {}) as Properties;
  const text = (name: string) =>
    typeof props[name] === 'string' ? (props[name] as string).trim() : '';
  const names = object.fields.some((f) => f.name === 'first_name')
    ? [text('first_name'), text('last_name')].filter(Boolean).join(' ')
    : '';
  const first = object.fields[0] ? props[object.fields[0].name] : undefined;
  return (
    names ||
    (first === undefined || first === null || first === '' ? '' : String(first)) ||
    `${object.label} ${id}`
  );
}

/** Which column of `association` holds this record's side, and which the other's. */
const columns = (forward: boolean) => ({
  mine: Prisma.raw(forward ? '"source_id"' : '"target_id"'),
  other: Prisma.raw(forward ? '"target_id"' : '"source_id"'),
});

@Injectable()
export class AssociationsService {
  constructor(
    private readonly records: RecordsService,
    private readonly schema: SchemaService,
  ) {}

  /**
   * The link by name, seen from one object. The object must be one end of it: the one holding the
   * link field (forward) or the one it points at (reverse).
   */
  private async resolve(
    tx: TenantTransaction,
    ctx: RequestContext,
    objectName: string,
    linkName: string,
  ) {
    const object = await this.schema.loadObject(tx, ctx, objectName);
    const def = await tx.associationDefinition.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: linkName,
        isActive: true,
        OR: [{ sourceObjectTypeId: object.id }, { targetObjectTypeId: object.id }],
      },
    });
    if (!def) {
      throw notFound(`'${objectName}' records have no link '${linkName}'`);
    }
    const forward = def.sourceObjectTypeId === object.id;
    const otherType = await tx.objectType.findUniqueOrThrow({
      where: { id: forward ? def.targetObjectTypeId : def.sourceObjectTypeId },
    });
    const other = await this.schema.loadObject(tx, ctx, otherType.slug);
    return { object, other, def, forward };
  }

  /** The live records linked to this one that the caller may read, oldest link first. */
  private async visibleLinks(
    tx: TenantTransaction,
    ctx: RequestContext,
    def: AssociationDefinition,
    forward: boolean,
    other: ObjectWithFields,
    recordId: bigint,
  ) {
    const { mine, other: theirs } = columns(forward);
    const scopes = await resolveScopes(tx, ctx, other.id, 'read');
    const rows = await tx.$queryRaw<{ id: bigint }[]>(Prisma.sql`
      SELECT a.${theirs} AS id FROM association a
      JOIN object_record r ON r."organization_id" = a."organization_id" AND r."id" = a.${theirs}
      WHERE a."organization_id" = ${ctx.organizationId} AND a."definition_id" = ${def.id} AND a.${mine} = ${recordId}
        AND r."deleted_at" IS NULL AND ${visibilitySql(ctx, scopes, 'read')}
      ORDER BY a."created_at", a.${theirs}`);
    return rows.map((row) => row.id);
  }

  async list(
    ctx: RequestContext,
    objectName: string,
    rawId: string,
    linkName: string,
    query: Record<string, string | undefined>,
  ) {
    assertCan(ctx, { record: ['read'] }, 'view records');
    const recordId = toId(rawId, objectName);
    const page = parse(paging, { page: query['page'], page_size: query['page_size'] });
    const pageSize = Math.min(page.page_size, MAX_PAGE_SIZE);

    return this.records.tenant(ctx, async (tx) => {
      const { object, other, def, forward } = await this.resolve(tx, ctx, objectName, linkName);
      await this.records.loadFor(tx, ctx, object, recordId, 'read');
      const ids = await this.visibleLinks(tx, ctx, def, forward, other, recordId);
      const pageIds = ids.slice((page.page - 1) * pageSize, page.page * pageSize);
      const rows = await tx.objectRecord.findMany({ where: { id: { in: pageIds } } });
      const byId = new Map(rows.map((row) => [row.id, row]));
      const dtos = new Map((await this.records.dtos(tx, ctx, other, rows)).map((dto) => [BigInt(dto.id), dto]));
      const totalPages = Math.ceil(ids.length / pageSize);
      return {
        results: pageIds.flatMap((id) => {
          const row = byId.get(id);
          return row
            ? [{ ...dtos.get(id)!, label: recordLabel(other, id, row.properties) }]
            : [];
        }),
        metadata: {
          page: page.page,
          page_size: pageSize,
          total_elements: ids.length,
          total_pages: totalPages,
          has_next: page.page < totalPages,
          has_previous: page.page > 1,
        },
      };
    });
  }

  /** Make the set of linked records exactly this one. Links to records the caller cannot see are left alone. */
  async replace(
    ctx: RequestContext,
    objectName: string,
    rawId: string,
    linkName: string,
    body: unknown,
  ) {
    const input = parse(replaceBody, body);
    return this.change(ctx, objectName, rawId, linkName, () =>
      input.record_ids.map((id) => toId(id, 'record')),
    );
  }

  /** Link one more record, or, where this end holds only one, link it instead of the one it has. Linking twice changes nothing. */
  async link(
    ctx: RequestContext,
    objectName: string,
    rawId: string,
    linkName: string,
    body: unknown,
  ) {
    const input = parse(linkBody, body);
    const added = toId(input.record_id, 'record');
    return this.change(ctx, objectName, rawId, linkName, (current, only) =>
      only ? [added] : [...current, added],
    );
  }

  /** Remove one link. */
  async unlink(
    ctx: RequestContext,
    objectName: string,
    rawId: string,
    linkName: string,
    rawTargetId: string,
  ) {
    const removed = toId(rawTargetId, 'record');
    return this.change(ctx, objectName, rawId, linkName, (current) => {
      if (!current.includes(removed)) {
        throw notFound(`That ${objectName} is not linked to that record`);
      }
      return current.filter((id) => id !== removed);
    });
  }

  private async change(
    ctx: RequestContext,
    objectName: string,
    rawId: string,
    linkName: string,
    wanted: (current: bigint[], onlyOne: boolean) => bigint[],
  ) {
    assertCan(ctx, { record: ['update'] }, 'link records');
    const recordId = toId(rawId, objectName);

    return this.records.tenant(ctx, async (tx) => {
      const { object, other, def, forward } = await this.resolve(tx, ctx, objectName, linkName);
      // A link is a field on the record that holds it, so changing it takes the right to change that
      // record, and the record it points at need only be readable. From the holder's end that is this
      // record; from the other end it is each record being linked or unlinked (checked below), and this
      // one need only be readable. Either way the same people can make the same change.
      await this.records.loadFor(tx, ctx, object, recordId, forward ? 'write' : 'read');
      const { mine, other: theirs } = columns(forward);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`associations:${ctx.organizationId}:${def.id}`}))`;

      let current = await this.visibleLinks(tx, ctx, def, forward, other, recordId);
      // The end that holds the link field holds one record, or many as its field says; the other end always holds many.
      const onlyOne = forward && !def.many;
      if (onlyOne) {
        const stored = await tx.$queryRaw<{ id: bigint; deletedAt: Date | null }[]>(Prisma.sql`
          SELECT r."id", r."deleted_at" AS "deletedAt" FROM association a
          JOIN object_record r ON r."organization_id" = a."organization_id" AND r."id" = a."target_id"
          WHERE a."organization_id" = ${ctx.organizationId} AND a."definition_id" = ${def.id} AND a."source_id" = ${recordId}`);
        // A hidden live target must stay untouched; otherwise a new link would make this field hold two.
        if (stored.some((row) => row.deletedAt === null && !current.includes(row.id))) {
          throw forbidden('This link cannot be changed with your current access');
        }
        // Deleted targets no longer occupy the field, and their old associations can be replaced.
        current = stored.map((row) => row.id);
      }
      const desired = [...new Set(wanted(current, onlyOne))];
      if (onlyOne && desired.length > 1) {
        throw validationFailed([
          {
            field: 'record_ids',
            code: 'INVALID_FIELD',
            message: `A ${objectName} can be linked to only one here; send at most one id`,
          },
        ]);
      }

      const scopes = await resolveScopes(tx, ctx, other.id, 'read');
      const reachable = desired.length
        ? await tx.$queryRaw<{ id: bigint }[]>(Prisma.sql`
            SELECT r."id" FROM object_record r
            WHERE r."organization_id" = ${ctx.organizationId} AND r."object_type_id" = ${other.id} AND r."deleted_at" IS NULL
              AND r."id" = ANY(${desired}::bigint[]) AND ${visibilitySql(ctx, scopes, 'read')}`)
        : [];
      const found = new Set(reachable.map((row) => row.id));
      const missing = desired.filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw notFound(`No such ${other.slug}: ${missing.join(', ')}`);
      }

      const added = desired.filter((id) => !current.includes(id));
      const removed = current.filter((id) => !desired.includes(id));
      if (!forward) {
        const touched = [...new Set([...added, ...removed])];
        if (touched.length > 0) {
          const writeScopes = await resolveScopes(tx, ctx, other.id, 'write');
          const writable = await tx.$queryRaw<{ id: bigint }[]>(Prisma.sql`
            SELECT r."id" FROM object_record r
            WHERE r."organization_id" = ${ctx.organizationId} AND r."object_type_id" = ${other.id} AND r."deleted_at" IS NULL
              AND r."id" = ANY(${touched}::bigint[]) AND ${visibilitySql(ctx, writeScopes, 'write')}`);
          if (writable.length !== touched.length) {
            throw forbidden(
              `You are not allowed to change those ${other.slug} records, so their link cannot be changed from here`,
            );
          }
        }
      }
      if (removed.length > 0) {
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM association WHERE "organization_id" = ${ctx.organizationId} AND "definition_id" = ${def.id}
            AND ${mine} = ${recordId} AND ${theirs} = ANY(${removed}::bigint[])`);
      }
      // Linking from the end that points at a one-only field takes the record away from whatever it was linked to.
      const displaced =
        !forward && !def.many && added.length > 0
          ? await tx.$queryRaw<{ sourceId: bigint; targetId: bigint }[]>(Prisma.sql`
              DELETE FROM association
              WHERE "organization_id" = ${ctx.organizationId} AND "definition_id" = ${def.id}
                AND "source_id" = ANY(${added}::bigint[]) AND "target_id" <> ${recordId}
              RETURNING "source_id" AS "sourceId", "target_id" AS "targetId"`)
          : [];
      if (added.length > 0) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO association ("organization_id", "definition_id", ${mine}, ${theirs})
          SELECT ${ctx.organizationId}, ${def.id}, ${recordId}, unnest(${added}::bigint[])
          ON CONFLICT DO NOTHING`);
      }

      if (added.length > 0 || removed.length > 0 || displaced.length > 0) {
        const asText = (ids: bigint[]) => ids.map(String);
        const entry = (
          recordIdOf: bigint,
          objectTypeId: bigint,
          key: string,
          before: unknown,
          after: unknown,
        ) => ({
          organizationId: ctx.organizationId,
          recordId: recordIdOf,
          objectTypeId,
          action: 'UPDATE',
          changes: {
            [`associations.${key}`]: { old: before, new: after },
          } as Prisma.InputJsonObject,
          actorType: ctx.actorType,
          actorId: ctx.userId,
          requestId: ctx.requestId,
        });
        // History on both sides: what this record's links became, and that each of the others gained or lost this one.
        await tx.recordChange.createMany({
          data: [
            entry(recordId, object.id, linkName, asText(current), asText(desired)),
            ...added.map((id) => entry(id, other.id, linkName, null, String(recordId))),
            ...removed.map((id) => entry(id, other.id, linkName, String(recordId), null)),
            // What was moved: its old holder lost it, and it now has the new one in its place.
            ...displaced.flatMap((d) => [
              entry(d.targetId, object.id, linkName, String(d.sourceId), null),
              entry(d.sourceId, other.id, linkName, String(d.targetId), String(recordId)),
            ]),
          ],
        });
      }
      return { results: await this.labels(tx, other, desired) };
    });
  }

  private async labels(
    tx: TenantTransaction,
    other: ObjectWithFields,
    ids: bigint[],
  ): Promise<Linked[]> {
    const rows = await tx.objectRecord.findMany({ where: { id: { in: ids } } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [{ id: String(id), label: recordLabel(other, id, row.properties) }] : [];
    });
  }

  /**
   * For a page of records, who each is linked to, by kind: `{ company: [{ id, label }], deal: [...] }`.
   * Only records the caller may read, and not deleted ones. One query per kind, however many records.
   */
  async summaries(
    tx: TenantTransaction,
    ctx: RequestContext,
    object: ObjectWithFields,
    ids: bigint[],
  ) {
    const defs = await tx.associationDefinition.findMany({
      where: {
        organizationId: ctx.organizationId,
        isActive: true,
        OR: [{ sourceObjectTypeId: object.id }, { targetObjectTypeId: object.id }],
      },
      orderBy: { id: 'asc' },
    });
    const result = new Map<bigint, Record<string, Linked[]>>(ids.map((id) => [id, {}]));
    for (const def of defs) {
      const forward = def.sourceObjectTypeId === object.id;
      const otherType = await tx.objectType.findUnique({
        where: { id: forward ? def.targetObjectTypeId : def.sourceObjectTypeId },
      });
      if (!otherType) {
        continue;
      }
      const other = await this.schema.loadObject(tx, ctx, otherType.slug);
      for (const id of ids) {
        result.get(id)![def.name] = [];
      }
      if (ids.length === 0) {
        continue;
      }
      const { mine, other: theirs } = columns(forward);
      const scopes = await resolveScopes(tx, ctx, other.id, 'read');
      const rows = await tx.$queryRaw<
        { recordId: bigint; id: bigint; properties: unknown }[]
      >(Prisma.sql`
        SELECT a.${mine} AS "recordId", r."id" AS id, r."properties" AS properties FROM association a
        JOIN object_record r ON r."organization_id" = a."organization_id" AND r."id" = a.${theirs}
        WHERE a."organization_id" = ${ctx.organizationId} AND a."definition_id" = ${def.id} AND a.${mine} = ANY(${ids}::bigint[])
          AND r."deleted_at" IS NULL AND ${visibilitySql(ctx, scopes, 'read')}
        ORDER BY a."created_at", r."id"`);
      for (const row of rows) {
        const list = result.get(row.recordId)![def.name];
        if (list.length < MAX_SUMMARY) {
          list.push({ id: String(row.id), label: recordLabel(other, row.id, row.properties) });
        }
      }
    }
    return result;
  }
}
