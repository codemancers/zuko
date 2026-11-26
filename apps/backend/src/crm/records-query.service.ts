import { Injectable } from '@nestjs/common';
import * as z from 'zod';
import { Prisma } from '../generated/prisma/client';
import type { RequestContext } from './context';
import { AssociationsService } from './associations.service';
import { parse, validationFailed } from './errors';
import { assertCan, resolveScopes, visibilitySql } from './permissions';
import { OPERATORS, filterSql, orderSql, resolveColumn, type FilterGroup } from './query';
import { RecordsService } from './records.service';
import { SchemaService } from './schema.service';

const MAX_PAGE_SIZE = 100;

const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).default(20),
});

const sort = z.object({
  field: z.string().min(1),
  direction: z
    .string()
    .transform((d) => d.toUpperCase())
    .pipe(z.enum(['ASC', 'DESC'])),
});

const filterBody = z.object({
  filter_groups: z
    .array(
      z.object({
        logical_operator: z.enum(['AND', 'OR']).default('AND'),
        filters: z
          .array(
            z.object({
              field_path: z.string().min(1),
              operator: z.enum(OPERATORS),
              value: z.unknown().optional(),
              values: z.array(z.unknown()).optional(),
            }),
          )
          .max(50),
      }),
    )
    .max(20)
    .default([]),
  pagination: pagination.partial().optional(),
  sort: sort.optional(),
  // `associations` adds who each record is linked to, in the same response.
  include: z.array(z.literal('associations')).default([]),
});

/** "created_at,desc" as used in ?sort= on the list endpoint. */
function parseSortParam(raw: string | undefined) {
  if (!raw) {
    return undefined;
  }
  const [field, direction = 'asc'] = raw.split(',');
  return parse(sort, { field, direction });
}

@Injectable()
export class RecordsQueryService {
  constructor(
    private readonly records: RecordsService,
    private readonly schema: SchemaService,
    private readonly associations: AssociationsService,
  ) {}

  list(ctx: RequestContext, objectName: string, query: Record<string, string | undefined>) {
    const page = parse(pagination.partial(), {
      page: query['page'],
      page_size: query['page_size'],
    });
    const include = (query['include'] ?? '').split(',').includes('associations');
    return this.search(ctx, objectName, [], page, parseSortParam(query['sort']), include);
  }

  filter(ctx: RequestContext, objectName: string, body: unknown) {
    const input = parse(filterBody, body);
    return this.search(
      ctx,
      objectName,
      input.filter_groups as FilterGroup[],
      input.pagination ?? {},
      input.sort,
      input.include.includes('associations'),
    );
  }

  /** Distinct values/counts over the complete visible result set, for header checklists. */
  async facets(ctx: RequestContext, objectName: string, body: unknown) {
    const input = parse(filterBody.extend({ field: z.string().min(1) }), body);
    assertCan(ctx, { record: ['read'] }, 'view records');
    return this.records.tenant(ctx, async (tx) => {
      const object = await this.schema.loadObject(tx, ctx, objectName);
      const field = object.fields.find((candidate) => candidate.name === input.field);
      if (!field || field.sensitive || field.type === 'LINK') {
        throw validationFailed([
          {
            field: input.field,
            code: 'INVALID_FIELD',
            message: 'This field cannot be used for a column filter',
          },
        ]);
      }
      const column = resolveColumn(input.field, object.fields, 'filter');
      if ('code' in column) throw validationFailed([column]);
      const scopes = await resolveScopes(tx, ctx, object.id, 'read');
      const values = await tx.$queryRaw<{ value: unknown; count: bigint }[]>(Prisma.sql`
        SELECT ${column.expr} AS value, count(*) AS count FROM object_record r
        WHERE r."organizationId" = ${ctx.organizationId} AND r."objectTypeId" = ${object.id}
          AND r."deletedAt" IS NULL AND ${visibilitySql(ctx, scopes, 'read')}
          AND ${filterSql(input.filter_groups as FilterGroup[], object.fields)}
        GROUP BY 1 ORDER BY count DESC, value ASC NULLS FIRST LIMIT 1001`);
      return {
        results: values.slice(0, 1000).map((entry) => ({
          value:
            entry.value === null
              ? null
              : entry.value instanceof Date
                ? entry.value.toISOString()
                : String(entry.value),
          count: Number(entry.count),
        })),
        truncated: values.length > 1000,
      };
    });
  }

  private async search(
    ctx: RequestContext,
    objectName: string,
    groups: FilterGroup[],
    paging: { page?: number; page_size?: number },
    sorting: { field: string; direction: 'ASC' | 'DESC' } | undefined,
    withAssociations = false,
  ) {
    assertCan(ctx, { record: ['read'] }, 'view records');
    const page = paging.page ?? 1;
    const pageSize = Math.min(paging.page_size ?? 20, MAX_PAGE_SIZE);

    return this.records.tenant(ctx, async (tx) => {
      const object = await this.schema.loadObject(tx, ctx, objectName);
      const scopes = await resolveScopes(tx, ctx, object.id, 'read');
      const where = Prisma.sql`
        r."organizationId" = ${ctx.organizationId} AND r."objectTypeId" = ${object.id} AND r."deletedAt" IS NULL
        AND ${visibilitySql(ctx, scopes, 'read')} AND ${filterSql(groups, object.fields)}`;
      const order = orderSql(sorting, object.fields);

      const [{ total }] = await tx.$queryRaw<{ total: bigint }[]>(
        Prisma.sql`SELECT count(*) AS total FROM object_record r WHERE ${where}`,
      );
      const ids = (
        await tx.$queryRaw<{ id: bigint }[]>(
          Prisma.sql`SELECT r."id" FROM object_record r WHERE ${where} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        )
      ).map((row) => row.id);

      const rows = await tx.objectRecord.findMany({ where: { id: { in: ids } } });
      const byId = new Map(rows.map((row) => [row.id, row]));
      const linked = withAssociations
        ? await this.associations.summaries(tx, ctx, object, ids)
        : undefined;
      const totalElements = Number(total);
      const totalPages = Math.ceil(totalElements / pageSize);
      const dtos = new Map((await this.records.dtos(tx, ctx, object, rows)).map((dto) => [BigInt(dto.id), dto]));
      return {
        results: ids.flatMap((id) => {
          const row = byId.get(id);
          return row
            ? [
                {
                  ...dtos.get(id)!,
                  ...(linked ? { associations: linked.get(id) ?? {} } : {}),
                },
              ]
            : [];
        }),
        metadata: {
          page,
          page_size: pageSize,
          total_elements: totalElements,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_previous: page > 1,
        },
      };
    });
  }
}
