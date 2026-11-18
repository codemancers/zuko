import { Injectable } from '@nestjs/common';
import { roles as roleDefinitions } from '@zuko/access-control';
import * as z from 'zod';
import type { RequestContext } from './context';
import { badRequest, parse } from './errors';
import { assertCan, defaultScopesFor, SCOPES } from './permissions';
import { RecordsService } from './records.service';
import { SchemaService } from './schema.service';

const KNOWN_ROLES = Object.keys(roleDefinitions);
/** Always full access, so an organization cannot lock itself out of its own data. */
const FIXED_ROLES = ['owner', 'admin'];

const scope = z.enum(SCOPES as unknown as [string, ...string[]]);

const setBody = z.object({
  object: z.string().min(1).nullable().optional(),
  read_scope: scope,
  write_scope: scope,
});

@Injectable()
export class AccessService {
  constructor(
    private readonly records: RecordsService,
    private readonly schema: SchemaService,
  ) {}

  async list(ctx: RequestContext) {
    assertCan(ctx, { ac: ['read'] }, 'view access settings');
    const rows = await this.records.tenant(ctx, (tx) =>
      tx.roleObjectAccess.findMany({
        where: { organizationId: ctx.organizationId },
        include: { objectType: { select: { slug: true } } },
        orderBy: { id: 'asc' },
      }),
    );
    return {
      defaults: Object.fromEntries(
        KNOWN_ROLES.map((role) => {
          const { read, write } = defaultScopesFor(role);
          return [role, { read_scope: read, write_scope: write }];
        }),
      ),
      overrides: rows.map((row) => ({
        role: row.role,
        object: row.objectType?.slug ?? null,
        read_scope: row.readScope,
        write_scope: row.writeScope,
      })),
    };
  }

  private assertRole(role: string) {
    if (!KNOWN_ROLES.includes(role)) {
      throw badRequest('UNKNOWN_ROLE', `Unknown role '${role}'; known roles: ${KNOWN_ROLES.join(', ')}`);
    }
    if (FIXED_ROLES.includes(role)) {
      throw badRequest('ROLE_FIXED', `The ${role} role always has access to every record`);
    }
  }

  /** Set the scopes for a role, for one object type or (object omitted/null) for all of them. */
  async set(ctx: RequestContext, role: string, body: unknown) {
    assertCan(ctx, { ac: ['update'] }, 'change access settings');
    this.assertRole(role);
    const input = parse(setBody, body);

    return this.records.tenant(ctx, async (tx) => {
      const objectTypeId = input.object ? (await this.schema.loadObject(tx, ctx, input.object)).id : null;
      const existing = await tx.roleObjectAccess.findFirst({
        where: { organizationId: ctx.organizationId, role, objectTypeId },
      });
      const data = { readScope: input.read_scope, writeScope: input.write_scope };
      if (existing) {
        await tx.roleObjectAccess.update({ where: { id: existing.id }, data });
      } else {
        await tx.roleObjectAccess.create({ data: { organizationId: ctx.organizationId, role, objectTypeId, ...data } });
      }
      return { role, object: input.object ?? null, read_scope: input.read_scope, write_scope: input.write_scope };
    });
  }

  /** Remove an override so the role falls back to its next-more-general setting. */
  async remove(ctx: RequestContext, role: string, object: string | undefined) {
    assertCan(ctx, { ac: ['update'] }, 'change access settings');
    this.assertRole(role);
    return this.records.tenant(ctx, async (tx) => {
      const objectTypeId = object ? (await this.schema.loadObject(tx, ctx, object)).id : null;
      const { count } = await tx.roleObjectAccess.deleteMany({
        where: { organizationId: ctx.organizationId, role, objectTypeId },
      });
      return { role, object: object ?? null, removed: count };
    });
  }
}
