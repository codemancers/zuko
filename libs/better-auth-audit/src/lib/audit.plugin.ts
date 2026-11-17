import type { BetterAuthPlugin } from 'better-auth';

export const AUDIT_PLUGIN_ID = 'audit';

/**
 * Append-only log of auth and organization events (sign-in, invitations, member,
 * role and team changes, MCP grants).
 *
 * Record-level changes are NOT handled here: they must be written in the same
 * database transaction as the record write, so they live in the domain service.
 *
 * Register last so its hooks see events from the other plugins. Hooks are added
 * incrementally.
 */
export const audit = () =>
  ({
    id: AUDIT_PLUGIN_ID,
    schema: {
      auditEvent: {
        fields: {
          // null for platform-level events
          organizationId: { type: 'number', bigint: true, required: false, index: true },
          actorType: { type: 'string', required: true },
          actorId: { type: 'number', bigint: true, required: false },
          event: { type: 'string', required: true, index: true },
          targetType: { type: 'string', required: false },
          targetId: { type: 'number', bigint: true, required: false },
          metadata: { type: 'json', required: false },
          ip: { type: 'string', required: false },
          userAgent: { type: 'string', required: false },
          requestId: { type: 'string', required: false },
          createdAt: { type: 'date', required: true, defaultValue: () => new Date() },
        },
      },
    },
  }) satisfies BetterAuthPlugin;
