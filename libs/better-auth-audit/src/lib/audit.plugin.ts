import type { BetterAuthPlugin, DBAdapter } from 'better-auth';
import { createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { EVENT_SPECS, numericId, pick, type AuditEventInput } from './audit.events.js';

export const AUDIT_PLUGIN_ID = 'audit';

/** Whether the user belongs to the organization. A lookup that fails counts as no. */
async function isMember(adapter: DBAdapter, userId: string, organizationId: string): Promise<boolean> {
  try {
    const member = await adapter.findOne<{ id: unknown }>({
      model: 'member',
      where: [
        { field: 'userId', value: userId },
        { field: 'organizationId', value: organizationId },
      ],
    });
    return member !== null;
  } catch {
    return false;
  }
}

export type { ActorType, AuditEventInput } from './audit.events.js';

export type AuditWriter = (event: AuditEventInput, context: { adapter: DBAdapter }) => Promise<void>;

export interface AuditOptions {
  /**
   * Where events go. Defaults to the plugin's own `auditEvent` table through
   * better-auth's adapter. Provide your own to write inside a tenant context, for
   * example when the table is protected by row-level security.
   */
  write?: AuditWriter;
}

type Bag = Record<string, unknown>;

const defaultWriter: AuditWriter = async (event, { adapter }) => {
  await adapter.create({ model: 'auditEvent', data: { ...event, createdAt: new Date() } });
};

function client(headers: Headers | undefined) {
  const forwarded = headers?.get('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    ip: forwarded || headers?.get('x-real-ip') || null,
    userAgent: headers?.get('user-agent') ?? null,
    requestId: headers?.get('x-request-id') ?? null,
  };
}

/**
 * Append-only log of auth and organization events: sign-up and sign-in (including
 * failures), organization, invitation, member, role and team changes, and reporting
 * lines. Which events and which request fields are recorded is listed in
 * `audit.events.ts`.
 *
 * Record-level changes are NOT handled here: they must be written in the same
 * database transaction as the record write, so they live in the domain service.
 *
 * Writing is best effort: a failure is logged and never breaks the request, because
 * the audited action has already happened by the time an after-hook runs.
 *
 * Register last so its hooks see events from the other plugins.
 */
export const audit = (options: AuditOptions = {}) => {
  const write = options.write ?? defaultWriter;

  return {
    id: AUDIT_PLUGIN_ID,
    hooks: {
      after: [
        {
          matcher: (context) => context.path !== undefined && context.path in EVENT_SPECS,
          handler: createAuthMiddleware(async (ctx) => {
            const spec = EVENT_SPECS[ctx.path];
            if (!spec) {
              return;
            }
            try {
              const returned = ctx.context.returned;
              const failed = returned instanceof Error;
              if (failed && !spec.failedEvent) {
                return;
              }

              const body = (ctx.body ?? {}) as Bag;
              const result = (failed || typeof returned !== 'object' || returned === null ? {} : returned) as Bag;
              const session =
                ctx.context.newSession ?? ctx.context.session ?? (await getSessionFromCtx(ctx).catch(() => null));
              const userId = failed ? null : (session?.user.id ?? null);
              const activeOrganization = (session?.session as Bag | undefined)?.activeOrganizationId;

              // Where the event belongs: what the endpoint itself says, else the organization the request
              // names, else the session's. What a request names is only a claim: endpoints that really act
              // on an organization have already required the caller to belong to it, but the others
              // (sign-up, consent, ...) ignore it, so a caller who is not a member must not be able to put
              // an event in that organization's trail by naming it.
              let organization = spec.organization?.(body, result);
              if (organization === undefined || organization === null) {
                const claimed = numericId(body['organizationId']);
                organization =
                  !failed && claimed !== null && userId !== null && (await isMember(ctx.context.adapter, userId, claimed))
                    ? claimed
                    : activeOrganization;
              }

              const input: AuditEventInput = {
                organizationId: failed ? null : numericId(organization),
                actorType: userId === null ? 'ANONYMOUS' : 'USER',
                actorId: userId === null ? null : numericId(userId),
                event: failed ? (spec.failedEvent as string) : spec.event,
                targetType: spec.targetType ?? null,
                targetId: numericId(spec.target?.(body, result)),
                metadata: pick(body, spec.metadata),
                ...client(ctx.headers),
              };
              await write(input, { adapter: ctx.context.adapter });
            } catch (error) {
              ctx.context.logger.error('Failed to write audit event', error);
            }
          }),
        },
      ],
    },
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
  } satisfies BetterAuthPlugin;
};
