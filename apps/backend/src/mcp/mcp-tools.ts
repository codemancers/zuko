import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import type { RequestContext } from '../crm/context';
import type { DirectoryService } from '../crm/directory.service';
import { CrmError } from '../crm/errors';
import { OPERATORS } from '../crm/query';
import type { RecordsQueryService } from '../crm/records-query.service';
import type { RecordsService } from '../crm/records.service';
import type { SchemaService } from '../crm/schema.service';
import { MCP_SCOPES } from '../libs/better-auth/constants';

export interface McpDeps {
  schema: SchemaService;
  records: RecordsService;
  queries: RecordsQueryService;
  directory: DirectoryService;
}

const INSTRUCTIONS = `This server gives access to one organization's CRM data on behalf of the signed-in user.
You can only see and change what that user may. Start with list_object_types and
describe_object_type to learn the objects and their fields before reading or writing records.
Object type names are singular (for example "deal"). Ids are strings. Field names are snake_case
and values must match the field type. Deleting a record cannot be undone through this server.`;

const object = z.string().describe('Singular object type name, e.g. "deal". See list_object_types.');
const recordId = z.string().describe('Record id (a string of digits).');
const sortParam = z.string().optional().describe('"field,asc" or "field,desc"; created_at, updated_at or a filterable field.');
const assignee = z.string().nullable().optional().describe('Member user id from list_members; null leaves it unassigned.');

const filterGroups = z
  .array(
    z.object({
      logical_operator: z.enum(['AND', 'OR']).optional().describe('How filters in this group combine (default AND). Groups combine with OR.'),
      filters: z.array(
        z.object({
          field_path: z.string().describe('A filterable field, or id, owner_id, team_id, created_at, updated_at.'),
          operator: z.enum(OPERATORS),
          value: z.unknown().optional().describe('For single-value operators.'),
          values: z.array(z.unknown()).optional().describe('For IN, NOT_IN and BETWEEN (two values).'),
        }),
      ),
    }),
  )
  .optional();

const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });

/** Failures the model can act on are returned as tool errors, not protocol errors. */
async function run(work: () => Promise<unknown>) {
  try {
    return json(await work());
  } catch (error) {
    if (error instanceof CrmError) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: JSON.stringify({ code: error.code, message: error.message, errors: error.errors }, null, 2) }],
      };
    }
    throw error;
  }
}

/**
 * The tools for one authenticated request. Each tool does what the matching REST endpoint
 * does, through the same services, so permissions, scopes and history behave identically.
 * On top of the user's own permissions, a tool needs the matching OAuth scope on the token,
 * so a read-only connection can never write, even for an admin.
 */
export function buildMcpServer(deps: McpDeps, ctx: RequestContext, granted: ReadonlySet<string>): McpServer {
  const server = new McpServer({ name: 'zuko-crm', version: '1.0.0' }, { instructions: INSTRUCTIONS });

  const needs = (scope: string) => async (work: () => Promise<unknown>) =>
    run(async () => {
      if (!granted.has(scope)) {
        throw new CrmError(403, 'INSUFFICIENT_SCOPE', `This connection was not granted '${scope}'; reconnect and approve it`);
      }
      return work();
    });
  const read = needs(MCP_SCOPES.read);
  const write = needs(MCP_SCOPES.write);
  const remove = needs(MCP_SCOPES.delete);
  const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

  server.registerTool(
    'list_object_types',
    { title: 'List object types', description: 'List the kinds of records in this CRM (contact, deal, ...).', inputSchema: z.object({}), annotations: readOnly },
    () => read(() => deps.schema.list(ctx)),
  );

  server.registerTool(
    'describe_object_type',
    {
      title: 'Describe an object type',
      description: 'Fields, types, required/unique/filterable flags and enum options. Call before creating, updating or filtering records.',
      inputSchema: z.object({ object }),
      annotations: readOnly,
    },
    ({ object }) => read(() => deps.schema.describe(ctx, object)),
  );

  server.registerTool(
    'list_members',
    { title: 'List members', description: 'People in the organization with their user ids, e.g. to assign a record owner.', inputSchema: z.object({}), annotations: readOnly },
    () => read(() => deps.directory.members(ctx)),
  );

  server.registerTool(
    'list_teams',
    { title: 'List teams', description: 'Teams in the organization with their ids.', inputSchema: z.object({}), annotations: readOnly },
    () => read(() => deps.directory.teams(ctx)),
  );

  server.registerTool(
    'list_records',
    {
      title: 'List records',
      description: 'Page through the records of an object type that the user may see, newest first by default.',
      inputSchema: z.object({
        object,
        page: z.number().int().min(1).optional(),
        page_size: z.number().int().min(1).max(100).optional(),
        sort: sortParam,
      }),
      annotations: readOnly,
    },
    ({ object, page, page_size, sort }) =>
      read(() =>
        deps.queries.list(ctx, object, {
          page: page === undefined ? undefined : String(page),
          page_size: page_size === undefined ? undefined : String(page_size),
          sort,
        }),
      ),
  );

  server.registerTool(
    'filter_records',
    {
      title: 'Search records',
      description: 'Find records with filters (equals, ranges, IN, null checks, contains/starts/ends with), sorting and paging. Only filterable fields can be used.',
      inputSchema: z.object({
        object,
        filter_groups: filterGroups,
        pagination: z.object({ page: z.number().int().min(1).optional(), page_size: z.number().int().min(1).max(100).optional() }).optional(),
        sort: z.object({ field: z.string(), direction: z.enum(['ASC', 'DESC', 'asc', 'desc']) }).optional(),
      }),
      annotations: readOnly,
    },
    ({ object, ...body }) => read(() => deps.queries.filter(ctx, object, body)),
  );

  server.registerTool(
    'get_record',
    { title: 'Get a record', description: 'Fetch one record by id.', inputSchema: z.object({ object, id: recordId }), annotations: readOnly },
    ({ object, id }) => read(() => deps.records.get(ctx, object, id)),
  );

  server.registerTool(
    'get_record_history',
    {
      title: 'Get record history',
      description: 'Who changed what on a record and when, newest first.',
      inputSchema: z.object({ object, id: recordId }),
      annotations: readOnly,
    },
    ({ object, id }) => read(() => deps.records.history(ctx, object, id)),
  );

  server.registerTool(
    'create_record',
    {
      title: 'Create a record',
      description: 'Create a record. Properties must match the object\'s fields (see describe_object_type). The creator owns it unless owner_id is given.',
      inputSchema: z.object({ object, properties: z.record(z.string(), z.unknown()), owner_id: assignee, team_id: assignee }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    ({ object, ...body }) => write(() => deps.records.create(ctx, object, body)),
  );

  server.registerTool(
    'update_record',
    {
      title: 'Update a record',
      description: 'Change some properties of a record; fields not mentioned stay as they are, and null clears an optional field.',
      inputSchema: z.object({ object, id: recordId, properties: z.record(z.string(), z.unknown()).optional(), owner_id: assignee, team_id: assignee }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ object, id, ...body }) => write(() => deps.records.update(ctx, object, id, body)),
  );

  server.registerTool(
    'delete_record',
    {
      title: 'Delete a record',
      description: 'Delete a record. It disappears from the CRM and this cannot be undone through this server.',
      inputSchema: z.object({ object, id: recordId }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ object, id }) => remove(() => deps.records.remove(ctx, object, id)),
  );

  return server;
}
