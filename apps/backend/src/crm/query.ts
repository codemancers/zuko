import { Prisma } from '../generated/prisma/client';
import { validationFailed, type FieldError } from './errors';
import { parseId } from './ids';
import type { FieldDef } from './field-types';

export const OPERATORS = [
  'EQUALS',
  'NOT_EQUALS',
  'GREATER_THAN',
  'LESS_THAN',
  'GREATER_THAN_OR_EQUAL_TO',
  'LESS_THAN_OR_EQUAL_TO',
  'BETWEEN',
  'IN',
  'NOT_IN',
  'IS_NULL',
  'IS_NOT_NULL',
  'CONTAINS',
  'STARTS_WITH',
  'ENDS_WITH',
] as const;
export type Operator = (typeof OPERATORS)[number];

export interface Filter {
  field_path: string;
  operator: Operator;
  value?: unknown;
  values?: unknown[];
}
export interface FilterGroup {
  logical_operator: 'AND' | 'OR';
  filters: Filter[];
}

type Kind = 'text' | 'number' | 'boolean' | 'timestamp' | 'id';

interface Column {
  expr: Prisma.Sql;
  kind: Kind;
  /** Postgres type used to cast bound values and arrays. */
  pg: string;
}

const SYSTEM_COLUMNS: Record<string, Column> = {
  id: { expr: Prisma.raw('r."id"'), kind: 'id', pg: 'bigint' },
  owner_id: { expr: Prisma.raw('r."owner_id"'), kind: 'id', pg: 'bigint' },
  team_id: { expr: Prisma.raw('r."team_id"'), kind: 'id', pg: 'bigint' },
  // These columns are `timestamp` holding UTC, and the request values are UTC ISO strings, so the
  // values are cast to plain `timestamp` (a trailing Z is ignored) and compared as such. Casting to
  // timestamptz instead would convert the column using the session's timezone.
  created_at: { expr: Prisma.raw('r."created_at"'), kind: 'timestamp', pg: 'timestamp' },
  updated_at: { expr: Prisma.raw('r."updated_at"'), kind: 'timestamp', pg: 'timestamp' },
};

const KIND_BY_TYPE: Record<string, Kind> = {
  TEXT: 'text',
  EMAIL: 'text',
  ENUM: 'text',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  TIMESTAMP: 'timestamp',
};
const PG_BY_KIND: Record<Kind, string> = {
  text: 'text',
  number: 'numeric',
  boolean: 'boolean',
  timestamp: 'timestamptz',
  id: 'bigint',
};

/**
 * The SQL column for a field path: a system column, or a property whose field is
 * marked filterable. The property name is bound as a parameter, never spliced in.
 */
export function resolveColumn(
  path: string,
  fields: readonly FieldDef[],
  usage: 'filter' | 'sort',
): Column | FieldError {
  const system = SYSTEM_COLUMNS[path];
  if (system) {
    return system;
  }
  const field = fields.find((f) => f.name === path);
  if (!field) {
    return {
      field: path,
      code: usage === 'sort' ? 'INVALID_SORT_FIELD' : 'INVALID_FIELD',
      message: `'${path}' is not a field of this object`,
    };
  }
  if (!field.filterable) {
    return {
      field: path,
      code: usage === 'sort' ? 'INVALID_SORT_FIELD' : 'INVALID_FIELD',
      message: `Field '${path}' is not ${usage === 'sort' ? 'sortable' : 'filterable'}; mark it filterable first`,
    };
  }
  const kind = KIND_BY_TYPE[field.type] ?? 'text';
  const raw = Prisma.sql`(r."properties"->>${path})`;
  const expr = kind === 'text' ? raw : Prisma.sql`${raw}::${Prisma.raw(PG_BY_KIND[kind])}`;
  return { expr, kind, pg: PG_BY_KIND[kind] };
}

const isError = (c: Column | FieldError): c is FieldError => 'code' in c;

/** Convert a request value to what the column compares against, or undefined if it does not fit. */
function coerce(kind: Kind, value: unknown): unknown {
  switch (kind) {
    case 'text':
      return typeof value === 'string' ? value : undefined;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    case 'boolean':
      return typeof value === 'boolean' ? value : undefined;
    case 'timestamp': {
      const time = typeof value === 'string' ? new Date(value) : null;
      return time && !Number.isNaN(time.getTime()) ? time.toISOString() : undefined;
    }
    case 'id':
      return parseId(value);
  }
}

const likeEscape = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

function compile(filter: Filter, fields: readonly FieldDef[], errors: FieldError[]): Prisma.Sql {
  const column = resolveColumn(filter.field_path, fields, 'filter');
  if (isError(column)) {
    errors.push(column);
    return Prisma.sql`FALSE`;
  }
  const bad = (message: string) => {
    errors.push({ field: filter.field_path, code: 'INVALID_FIELD', message });
    return Prisma.sql`FALSE`;
  };
  const { expr, kind, pg } = column;
  const one = () => coerce(kind, filter.value);
  const many = () => (filter.values ?? []).map((v) => coerce(kind, v));
  const cast = Prisma.raw(pg);
  const op = filter.operator;

  switch (op) {
    case 'IS_NULL':
      return Prisma.sql`${expr} IS NULL`;
    case 'IS_NOT_NULL':
      return Prisma.sql`${expr} IS NOT NULL`;
    case 'EQUALS':
    case 'NOT_EQUALS': {
      const v = one();
      if (v === undefined) {
        return bad(`'${op}' needs a ${kind} value`);
      }
      return op === 'EQUALS'
        ? Prisma.sql`${expr} = ${v}::${cast}`
        : Prisma.sql`${expr} IS DISTINCT FROM ${v}::${cast}`;
    }
    case 'GREATER_THAN':
    case 'LESS_THAN':
    case 'GREATER_THAN_OR_EQUAL_TO':
    case 'LESS_THAN_OR_EQUAL_TO': {
      if (kind === 'text' || kind === 'boolean') {
        return bad(`'${op}' only applies to numbers, dates and ids`);
      }
      const v = one();
      if (v === undefined) {
        return bad(`'${op}' needs a ${kind} value`);
      }
      const symbol = {
        GREATER_THAN: '>',
        LESS_THAN: '<',
        GREATER_THAN_OR_EQUAL_TO: '>=',
        LESS_THAN_OR_EQUAL_TO: '<=',
      }[op];
      return Prisma.sql`${expr} ${Prisma.raw(symbol)} ${v}::${cast}`;
    }
    case 'BETWEEN': {
      const [low, high] = many();
      if (
        kind === 'text' ||
        kind === 'boolean' ||
        (filter.values ?? []).length !== 2 ||
        low === undefined ||
        high === undefined
      ) {
        return bad("'BETWEEN' needs exactly two numeric, date or id values");
      }
      return Prisma.sql`${expr} BETWEEN ${low}::${cast} AND ${high}::${cast}`;
    }
    case 'IN':
    case 'NOT_IN': {
      const supplied = filter.values ?? [];
      const includesNull = supplied.includes(null);
      const list = supplied.filter((value) => value !== null).map((value) => coerce(kind, value));
      if (
        supplied.length === 0 ||
        supplied.length > 1000 ||
        list.some((value) => value === undefined)
      ) {
        return bad(`'${op}' needs between 1 and 1000 ${kind} values`);
      }
      if (list.length === 0)
        return op === 'IN' ? Prisma.sql`${expr} IS NULL` : Prisma.sql`${expr} IS NOT NULL`;
      if (op === 'IN')
        return includesNull
          ? Prisma.sql`(${expr} IS NULL OR ${expr} = ANY(${list}::${cast}[]))`
          : Prisma.sql`${expr} = ANY(${list}::${cast}[])`;
      return includesNull
        ? Prisma.sql`(${expr} IS NOT NULL AND ${expr} <> ALL(${list}::${cast}[]))`
        : Prisma.sql`(${expr} IS NULL OR ${expr} <> ALL(${list}::${cast}[]))`;
    }
    case 'CONTAINS':
    case 'STARTS_WITH':
    case 'ENDS_WITH': {
      const v = one();
      if (kind !== 'text' || typeof v !== 'string') {
        return bad(`'${op}' only applies to text values`);
      }
      const escaped = likeEscape(v);
      const pattern =
        op === 'CONTAINS' ? `%${escaped}%` : op === 'STARTS_WITH' ? `${escaped}%` : `%${escaped}`;
      return Prisma.sql`${expr} ILIKE ${pattern} ESCAPE '\\'`;
    }
    default:
      return bad(`Unknown operator '${String(op)}'`);
  }
}

/** Groups are ORed together; the filters inside a group use the group's operator. */
export function filterSql(groups: readonly FilterGroup[], fields: readonly FieldDef[]): Prisma.Sql {
  const errors: FieldError[] = [];
  const compiled = groups
    .filter((group) => group.filters.length > 0)
    .map((group) => {
      const parts = group.filters.map((filter) => compile(filter, fields, errors));
      return Prisma.sql`(${Prisma.join(parts, group.logical_operator === 'OR' ? ' OR ' : ' AND ')})`;
    });
  if (errors.length > 0) {
    throw validationFailed(errors);
  }
  return compiled.length === 0 ? Prisma.sql`TRUE` : Prisma.sql`(${Prisma.join(compiled, ' OR ')})`;
}

/** ORDER BY clause: a system column or filterable field, with id as the tie-breaker. */
export function orderSql(
  sort: { field: string; direction: 'ASC' | 'DESC' } | undefined,
  fields: readonly FieldDef[],
): Prisma.Sql {
  const field = sort?.field ?? 'created_at';
  const direction = Prisma.raw((sort?.direction ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC');
  const column = resolveColumn(field, fields, 'sort');
  if (isError(column)) {
    throw validationFailed([column]);
  }
  return Prisma.sql`${column.expr} ${direction} NULLS LAST, r."id" ${direction}`;
}
