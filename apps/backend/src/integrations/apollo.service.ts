import { Injectable, Logger } from '@nestjs/common';
import * as z from 'zod';
import { CrmError, badRequest, conflict, parse, validationFailed } from '../crm/errors';
import type { RequestContext } from '../crm/context';
import { assertCan } from '../crm/permissions';
import { RecordsService, toId } from '../crm/records.service';
import { SchemaService } from '../crm/schema.service';
import { writeAuditEvent } from '../libs/better-auth/audit-sink';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { requestInfo } from '../connections/http';
import {
  SUBJECT_BY_OBJECT,
  matchOrganization,
  matchPerson,
  organizationQuery,
  personQuery,
  planUpdate,
  type Subject,
} from './apollo-mapping';
import { KoshaClient, type Upstream } from './kosha.client';

type Request = ReturnType<typeof requestInfo>;

const connectBody = z.object({ api_key: z.string().trim().min(8, 'Enter your Apollo API key').max(500) });
const enrichBody = z
  .object({
    domain: z.string().trim().max(200).optional(),
    organization_name: z.string().trim().max(200).optional(),
    overwrite: z.boolean().default(false),
  })
  .default({ overwrite: false });

/** One connection per organization: an Apollo key acts as the whole workspace, not as one person. */
const ownerOf = (ctx: Pick<RequestContext, 'organizationId'>) => `org-${ctx.organizationId}`;

@Injectable()
export class ApolloService {
  private readonly logger = new Logger(ApolloService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kosha: KoshaClient,
    private readonly records: RecordsService,
    private readonly schema: SchemaService,
  ) {}

  async status(ctx: RequestContext) {
    assertCan(ctx, { record: ['read'] }, 'see integrations');
    const connection = await this.kosha.find(ownerOf(ctx));
    const label = connection?.metadata?.['label'] ?? connection?.metadata?.['email'];
    return {
      provider: 'apollo',
      connected: connection !== null,
      account: typeof label === 'string' ? label : null,
      connected_at: connection?.createdAt ?? null,
    };
  }

  async connect(ctx: RequestContext, body: unknown, request: Request) {
    assertCan(ctx, { integration: ['manage'] }, 'connect integrations');
    const { api_key } = parse(connectBody, body);
    // Checked before the old connection is touched, so a typo cannot disconnect a working key.
    await this.checkKey(api_key);
    const owner = ownerOf(ctx);
    const existing = await this.kosha.find(owner);
    if (existing) await this.kosha.revoke(existing.id);
    await this.kosha.connect(owner, api_key);
    await this.audit(ctx, request, 'apollo.connected', { replaced: existing !== null });
    return this.status(ctx);
  }

  async disconnect(ctx: RequestContext, request: Request) {
    assertCan(ctx, { integration: ['manage'] }, 'disconnect integrations');
    const existing = await this.kosha.find(ownerOf(ctx));
    if (existing) {
      await this.kosha.revoke(existing.id);
      await this.audit(ctx, request, 'apollo.disconnected', {});
    }
    return { provider: 'apollo', connected: false };
  }

  /** The free profile call Kosha itself uses; a key that cannot make it cannot be connected. */
  private async checkKey(apiKey: string) {
    let response: Response;
    try {
      response = await fetch('https://api.apollo.io/api/v1/users/api_profile', {
        headers: { 'x-api-key': apiKey },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new CrmError(502, 'APOLLO_UNAVAILABLE', 'Apollo did not respond');
    }
    if (response.status === 401 || response.status === 403) {
      throw new CrmError(
        400,
        'APOLLO_KEY_REJECTED',
        'Apollo did not accept that API key. It must be allowed to call GET /users/api_profile.',
      );
    }
    if (!response.ok) throw new CrmError(502, 'APOLLO_UNAVAILABLE', `Apollo answered ${response.status}`);
  }

  async enrichment(ctx: RequestContext, objectName: string, rawId: string) {
    assertCan(ctx, { record: ['read'] }, 'view records');
    const recordId = toId(rawId, objectName);
    return this.prisma.withTenant({ organizationId: ctx.organizationId, actorId: ctx.userId }, async (tx) => {
      const object = await this.schema.loadObject(tx, ctx, objectName);
      await this.records.loadFor(tx, ctx, object, recordId, 'read');
      const rows = await tx.recordEnrichment.findMany({
        where: { organizationId: ctx.organizationId, recordId },
        orderBy: { fetchedAt: 'desc' },
      });
      return {
        results: rows.map((row) => ({
          provider: row.provider,
          subject: row.subject,
          external_id: row.externalId,
          payload: row.payload,
          fetched_at: row.fetchedAt.toISOString(),
        })),
      };
    });
  }

  /**
   * Look a record up in Apollo, keep the response, and fill the record's empty fields from it. Apollo
   * charges credits per match, so nothing is retried and a record is looked up only when asked.
   */
  async enrich(ctx: RequestContext, objectName: string, rawId: string, body: unknown, request: Request) {
    assertCan(ctx, { record: ['enrich', 'update'] }, 'enrich records');
    const subject = SUBJECT_BY_OBJECT[objectName];
    if (!subject) {
      throw badRequest('NOT_ENRICHABLE', `Apollo can describe contacts, prospects, leads and companies, not '${objectName}'`);
    }
    const input = parse(enrichBody, body);
    const recordId = toId(rawId, objectName);

    // Authorize and read first, so no credit is spent on a record the caller may not change.
    const { current, fieldNames } = await this.prisma.withTenant(
      { organizationId: ctx.organizationId, actorId: ctx.userId },
      async (tx) => {
        const object = await this.schema.loadObject(tx, ctx, objectName);
        const row = await this.records.loadFor(tx, ctx, object, recordId, 'write');
        return {
          current: row.properties as Record<string, unknown>,
          fieldNames: new Set(object.fields.filter((f) => !f.readOnly && f.type !== 'LINK' && f.type !== 'FILE').map((f) => f.name)),
        };
      },
    );

    const hints = { domain: input.domain, organization_name: input.organization_name };
    const query = subject === 'PERSON' ? personQuery(current, hints) : organizationQuery(current, hints);
    if (!query) {
      throw validationFailed([
        {
          field: subject === 'PERSON' ? 'email' : 'domain',
          code: 'INSUFFICIENT_DATA',
          message:
            subject === 'PERSON'
              ? 'Apollo needs an email, or a first and last name with the company (pass domain or organization_name)'
              : 'Apollo needs the company website domain',
        },
      ]);
    }

    const owner = ownerOf(ctx);
    if (!(await this.kosha.find(owner))) {
      throw conflict('Apollo is not connected. An admin can connect it in Settings.');
    }
    const upstream =
      subject === 'PERSON'
        ? await this.kosha.call(owner, 'POST', '/people/match', query)
        : await this.kosha.call(owner, 'GET', '/organizations/enrich', query);
    const match = this.readUpstream(upstream, subject);

    if (!match) {
      await this.audit(ctx, request, 'record.enrich_no_match', { object: objectName, record_id: String(recordId) });
      return { matched: false, applied: [], skipped: [], record: await this.records.get(ctx, objectName, rawId) };
    }

    const plan = planUpdate(match.values, current, fieldNames, input.overwrite);
    // The raw response is kept even when nothing new fits a field, so it can be mapped again later.
    await this.prisma.withTenant({ organizationId: ctx.organizationId, actorId: ctx.userId }, (tx) =>
      tx.recordEnrichment.upsert({
        where: { recordId_provider_subject: { recordId, provider: 'apollo', subject } },
        create: {
          organizationId: ctx.organizationId,
          recordId,
          provider: 'apollo',
          subject,
          externalId: match.externalId,
          payload: upstream.body as Prisma.InputJsonValue,
          requestedBy: ctx.userId,
        },
        update: {
          externalId: match.externalId,
          payload: upstream.body as Prisma.InputJsonValue,
          requestedBy: ctx.userId,
          fetchedAt: new Date(),
        },
      }),
    );

    const { applied, skipped } = await this.apply(ctx, objectName, rawId, plan);
    await this.audit(ctx, request, 'record.enriched', {
      object: objectName,
      record_id: String(recordId),
      subject,
      applied,
    });
    return { matched: true, applied, skipped, record: await this.records.get(ctx, objectName, rawId) };
  }

  /**
   * Writes the planned values through the normal update, so history and validation apply. A value the
   * record cannot take (an email another record already has) is skipped, not allowed to fail the rest.
   */
  private async apply(ctx: RequestContext, objectName: string, rawId: string, plan: ReturnType<typeof planUpdate>) {
    const set = { ...plan.set };
    const skipped: { field: string; reason: string }[] = [...plan.skipped];
    for (let attempt = 0; attempt < 3 && Object.keys(set).length > 0; attempt++) {
      try {
        await this.records.update(ctx, objectName, rawId, { properties: set });
        break;
      } catch (error) {
        if (!(error instanceof CrmError) || error.code !== 'VALIDATION_FAILED' || error.errors.length === 0) throw error;
        for (const failure of error.errors) {
          if (failure.field in set) {
            delete set[failure.field];
            skipped.push({ field: failure.field, reason: failure.code });
          }
        }
      }
    }
    return { applied: Object.keys(set), skipped };
  }

  private readUpstream(upstream: Upstream, subject: Subject) {
    if (upstream.status === 404) return null;
    if (upstream.status === 401) {
      throw new CrmError(409, 'APOLLO_KEY_REJECTED', 'Apollo no longer accepts the saved API key. An admin should reconnect it.');
    }
    if (upstream.status === 403) {
      throw new CrmError(
        409,
        'APOLLO_FORBIDDEN',
        'The Apollo API key is not allowed to call this endpoint. Use a key that can call people/match and organizations/enrich.',
      );
    }
    if (upstream.status === 429) {
      throw new CrmError(429, 'APOLLO_RATE_LIMITED', `Apollo's rate limit was reached${upstream.retryAfter ? `; retry after ${upstream.retryAfter}s` : ''}`);
    }
    if (upstream.status < 200 || upstream.status >= 300) {
      throw new CrmError(502, 'APOLLO_UNAVAILABLE', `Apollo answered ${upstream.status}`);
    }
    return subject === 'PERSON' ? matchPerson(upstream.body) : matchOrganization(upstream.body);
  }

  /** Best effort, like the other audit events: the work is done and must not fail over the log. */
  private async audit(ctx: RequestContext, request: Request, event: string, metadata: Record<string, unknown>) {
    try {
      await writeAuditEvent(this.prisma, {
        organizationId: String(ctx.organizationId),
        actorType: ctx.actorType,
        actorId: String(ctx.userId),
        event,
        targetType: 'integration',
        targetId: null,
        metadata: { provider: 'apollo', ...metadata },
        ...request,
      });
    } catch (error) {
      this.logger.error('Failed to write audit event', error instanceof Error ? error.stack : String(error));
    }
  }
}
