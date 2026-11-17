import type { BetterAuthPlugin } from 'better-auth';

export const HIERARCHY_PLUGIN_ID = 'hierarchy';

/**
 * Reporting lines between organization members.
 *
 * Owns only identity-level data: who reports to whom, and the precomputed
 * ancestor/descendant closure. Record visibility rules live in the domain layer,
 * which asks this plugin "whose records can this user see?".
 *
 * Requires the `organization` plugin. Endpoints and hooks are added incrementally.
 */
export const hierarchy = () =>
  ({
    id: HIERARCHY_PLUGIN_ID,
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
  }) satisfies BetterAuthPlugin;
