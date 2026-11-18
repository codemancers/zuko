import type { BetterAuthOptions, BetterAuthPlugin, DBAdapter } from 'better-auth';
import { APIError, createAuthEndpoint, sessionMiddleware } from 'better-auth/api';
import * as z from 'zod';
import { computeClosure, wouldCreateCycle, type Id, type ReportingRow } from './hierarchy.core.js';

export const HIERARCHY_PLUGIN_ID = 'hierarchy';

type HierarchyAdapter = Omit<DBAdapter, 'transaction'>;

export interface HierarchyOptions {
  /** Organization roles allowed to change anyone's manager. Defaults to owner and admin. */
  manageRoles?: string[];
  /** Database-backed deployments must serialize and transact the entire change across processes. */
  transaction?: (
    context: { organizationId: string; options: BetterAuthOptions },
    work: (adapter: HierarchyAdapter) => Promise<void>,
  ) => Promise<void>;
}

const DEFAULT_MANAGE_ROLES = ['owner', 'admin'];

const idSchema = z.union([z.string().min(1), z.number().int()]).transform(String);

interface OrgState {
  members: Map<Id, string>; // userId -> comma-separated roles
  reporting: ReportingRow[];
}

async function loadState(adapter: HierarchyAdapter, organizationId: string): Promise<OrgState> {
  const memberRows = await adapter.findMany<{ userId: unknown; role: string | null }>({
    model: 'member',
    where: [{ field: 'organizationId', value: organizationId }],
  });
  const reportingRows = await adapter.findMany<{ userId: unknown; managerId: unknown }>({
    model: 'memberReporting',
    where: [{ field: 'organizationId', value: organizationId }],
  });
  return {
    members: new Map(memberRows.map((m) => [String(m.userId), m.role ?? ''])),
    reporting: reportingRows.map((r) => ({
      userId: String(r.userId),
      managerId: r.managerId == null ? null : String(r.managerId),
    })),
  };
}

/** Replace the organization's ancestor/descendant rows from its reporting lines. */
async function rebuildClosure(adapter: HierarchyAdapter, organizationId: string, state: OrgState) {
  const rows = computeClosure(new Set(state.members.keys()), state.reporting);
  await adapter.deleteMany({ model: 'memberHierarchy', where: [{ field: 'organizationId', value: organizationId }] });
  for (const row of rows) {
    await adapter.create({
      model: 'memberHierarchy',
      data: {
        organizationId,
        ancestorId: row.ancestorId,
        descendantId: row.descendantId,
        depth: row.depth,
      },
    });
  }
}

// activeOrganizationId is added to the session by the organization plugin, so it is
// not part of better-auth's base Session type.
function activeOrganization(session: { session: object }): string {
  const id = (session.session as { activeOrganizationId?: unknown }).activeOrganizationId;
  if (id == null || id === '') {
    throw new APIError('BAD_REQUEST', { message: 'No active organization', code: 'NO_ACTIVE_ORGANIZATION' });
  }
  return String(id);
}

function canManage(roles: string | undefined, manageRoles: string[]): boolean {
  return (roles ?? '')
    .split(',')
    .map((r) => r.trim())
    .some((r) => manageRoles.includes(r));
}

/**
 * Reporting lines between organization members.
 *
 * Owns only identity-level data: who reports to whom, and the precomputed
 * ancestor/descendant closure. Record visibility rules live in the domain layer,
 * which asks this plugin "whose records can this user see?".
 *
 * Requires the `organization` plugin. Endpoints and hooks are added incrementally.
 */
export const hierarchy = (options: HierarchyOptions = {}) => {
  const manageRoles = options.manageRoles ?? DEFAULT_MANAGE_ROLES;
  const pending = new Map<string, Promise<void>>();
  const serialize = async (organizationId: string, work: () => Promise<void>) => {
    const previous = pending.get(organizationId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(work);
    pending.set(organizationId, current);
    try {
      await current;
    } finally {
      if (pending.get(organizationId) === current) pending.delete(organizationId);
    }
  };

  const setManager = createAuthEndpoint(
    '/hierarchy/set-manager',
    {
      method: 'POST',
      body: z.object({ userId: idSchema, managerId: idSchema.nullable() }),
      use: [sessionMiddleware],
    },
    async (ctx) => {
      const session = ctx.context.session;
      const organizationId = activeOrganization(session);
      const adapter = ctx.context.adapter;
      const { userId, managerId } = ctx.body;

      const change = async (adapter: HierarchyAdapter) => {
        const state = await loadState(adapter, organizationId);
        if (!canManage(state.members.get(String(session.user.id)), manageRoles)) {
          throw new APIError('FORBIDDEN', {
            message: 'You are not allowed to change reporting lines',
            code: 'NOT_ALLOWED_TO_MANAGE_HIERARCHY',
          });
        }
        for (const id of managerId === null ? [userId] : [userId, managerId]) {
          if (!state.members.has(id)) {
            throw new APIError('BAD_REQUEST', {
              message: 'Both people must be members of the active organization',
              code: 'NOT_A_MEMBER',
            });
          }
        }
        if (managerId !== null && wouldCreateCycle(state.reporting, userId, managerId)) {
          throw new APIError('BAD_REQUEST', {
            message: 'That would create a reporting loop',
            code: 'HIERARCHY_CYCLE',
          });
        }

        const existing = state.reporting.some((r) => r.userId === userId);
        if (existing) {
          await adapter.update({
            model: 'memberReporting',
            where: [
              { field: 'organizationId', value: organizationId },
              { field: 'userId', value: userId },
            ],
            update: { managerId },
          });
        } else {
          await adapter.create({ model: 'memberReporting', data: { organizationId, userId, managerId } });
        }

        const reporting = [...state.reporting.filter((r) => r.userId !== userId), { userId, managerId }];
        await rebuildClosure(adapter, organizationId, { ...state, reporting });
      };
      if (options.transaction) {
        await options.transaction({ organizationId, options: ctx.context.options }, change);
      } else {
        // The memory adapter has no cross-process state. SQL deployments supply the runner above.
        await serialize(organizationId, () => adapter.transaction(change));
      }

      return ctx.json({ userId, managerId });
    },
  );

  const listReports = createAuthEndpoint(
    '/hierarchy/reports',
    {
      method: 'GET',
      query: z.object({
        userId: idSchema.optional(),
        depth: z.enum(['direct', 'all']).default('all'),
      }),
      use: [sessionMiddleware],
    },
    async (ctx) => {
      const session = ctx.context.session;
      const organizationId = activeOrganization(session);
      const adapter = ctx.context.adapter;
      const caller = String(session.user.id);
      const target = ctx.query.userId ?? caller;

      const members = await adapter.findMany<{ userId: unknown; role: string | null }>({
        model: 'member',
        where: [{ field: 'organizationId', value: organizationId }],
      });
      const roles = new Map(members.map((m) => [String(m.userId), m.role ?? '']));
      if (target !== caller && !canManage(roles.get(caller), manageRoles)) {
        throw new APIError('FORBIDDEN', {
          message: "You are not allowed to view someone else's reports",
          code: 'NOT_ALLOWED_TO_MANAGE_HIERARCHY',
        });
      }

      const rows = await adapter.findMany<{ descendantId: unknown; depth: number }>({
        model: 'memberHierarchy',
        where: [
          { field: 'organizationId', value: organizationId },
          { field: 'ancestorId', value: target },
          ...(ctx.query.depth === 'direct' ? [{ field: 'depth', value: 1 }] : []),
        ],
      });
      // The closure can lag behind a member leaving; only report current members.
      const userIds = rows.map((r) => String(r.descendantId)).filter((id) => roles.has(id));
      return ctx.json({ userIds });
    },
  );

  return {
    id: HIERARCHY_PLUGIN_ID,
    endpoints: { setManager, listReports },
    schema: {
      memberReporting: {
        fields: {
          organizationId: {
            type: 'number',
            bigint: true,
            required: true,
            references: { model: 'organization', field: 'id', onDelete: 'cascade' },
            index: true,
          },
          userId: {
            type: 'number',
            bigint: true,
            required: true,
            references: { model: 'user', field: 'id', onDelete: 'cascade' },
          },
          // null = top of the chart
          managerId: {
            type: 'number',
            bigint: true,
            required: false,
            references: { model: 'user', field: 'id', onDelete: 'set null' },
          },
        },
      },
      memberHierarchy: {
        fields: {
          organizationId: {
            type: 'number',
            bigint: true,
            required: true,
            references: { model: 'organization', field: 'id', onDelete: 'cascade' },
            index: true,
          },
          ancestorId: {
            type: 'number',
            bigint: true,
            required: true,
            references: { model: 'user', field: 'id', onDelete: 'cascade' },
            index: true,
          },
          descendantId: {
            type: 'number',
            bigint: true,
            required: true,
            references: { model: 'user', field: 'id', onDelete: 'cascade' },
          },
          // 1 = direct report
          depth: { type: 'number', required: true },
        },
      },
    },
  } satisfies BetterAuthPlugin;
};
