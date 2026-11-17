import { Injectable } from '@nestjs/common';
import * as z from 'zod';
import type { FieldDefinition, ObjectType } from '../generated/prisma/client';
import { PrismaService, type TenantTransaction } from '../prisma/prisma.service';
import type { RequestContext } from './context';
import { conflict, notFound, parse, validationFailed } from './errors';
import { FIELD_TYPES } from './field-types';
import { assertCan } from './permissions';
import { STANDARD_OBJECTS } from './standard-objects';

export type ObjectWithFields = ObjectType & { fields: FieldDefinition[] };

const slug = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,62}$/, 'must be lowercase letters, digits and underscores, starting with a letter');

const createObjectBody = z.object({
  slug,
  label: z.string().min(1).max(100),
  plural_label: z.string().min(1).max(100).optional(),
});

const createFieldBody = z.object({
  name: slug,
  label: z.string().min(1).max(100),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  filterable: z.boolean().default(false),
  read_only: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  max_length: z.number().int().positive().max(100_000).optional(),
  config: z.object({ options: z.array(z.string().min(1)).min(1).optional() }).optional(),
});

export const fieldDto = (f: FieldDefinition) => ({
  name: f.name,
  label: f.label,
  type: f.type,
  required: f.required,
  unique: f.isUnique,
  filterable: f.filterable,
  read_only: f.readOnly,
  sensitive: f.sensitive,
  max_length: f.maxLength,
  config: f.config,
});

export const objectDto = (o: ObjectType, fields?: FieldDefinition[]) => ({
  id: String(o.id),
  name: o.slug,
  label: o.label,
  plural_label: o.pluralLabel,
  object_kind: o.kind,
  version: o.version,
  ...(fields ? { fields: fields.map(fieldDto) } : {}),
});

@Injectable()
export class SchemaService {
  constructor(private readonly prisma: PrismaService) {}

  private tenant<T>(ctx: RequestContext, fn: (tx: TenantTransaction) => Promise<T>) {
    return this.prisma.withTenant({ organizationId: ctx.organizationId, actorId: ctx.userId }, fn);
  }

  /** Load an object type with its fields, or 404. Object types are singular in URLs. */
  async loadObject(tx: TenantTransaction, ctx: RequestContext, name: string): Promise<ObjectWithFields> {
    const object = await tx.objectType.findFirst({
      where: { organizationId: ctx.organizationId, slug: name },
      include: { fields: { orderBy: { id: 'asc' } } },
    });
    if (!object) {
      throw notFound(`Object type '${name}' does not exist (use the singular name, e.g. 'contact')`);
    }
    return object;
  }

  async list(ctx: RequestContext) {
    assertCan(ctx, { record: ['read'] }, 'view object types');
    const objects = await this.tenant(ctx, (tx) =>
      tx.objectType.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { id: 'asc' } }),
    );
    return { results: objects.map((o) => objectDto(o)) };
  }

  async describe(ctx: RequestContext, name: string) {
    assertCan(ctx, { record: ['read'] }, 'view object types');
    const object = await this.tenant(ctx, (tx) => this.loadObject(tx, ctx, name));
    return objectDto(object, object.fields);
  }

  async createObject(ctx: RequestContext, body: unknown) {
    assertCan(ctx, { object: ['manage'] }, 'create object types');
    const input = parse(createObjectBody, body);
    const created = await this.tenant(ctx, (tx) =>
      tx.objectType.create({
        data: {
          organizationId: ctx.organizationId,
          slug: input.slug,
          label: input.label,
          pluralLabel: input.plural_label ?? `${input.label}s`,
          kind: 'CUSTOM',
        },
      }),
    );
    return objectDto(created, []);
  }

  /**
   * Create the standard objects (contact, company, deal) the organization does not have yet.
   * Safe to repeat: an object that exists is left exactly as it is, so nothing anyone has
   * customized is overwritten.
   */
  async setupStandardObjects(ctx: RequestContext) {
    assertCan(ctx, { object: ['manage'] }, 'set up the standard objects');
    return this.tenant(ctx, async (tx) => {
      // Two requests setting up the same organization at once (two tabs, a double render)
      // would both find nothing and both try to create. Take turns instead: the second one
      // then sees what the first one made and creates nothing.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`standard-objects:${ctx.organizationId}`}))`;
      const created: string[] = [];
      for (const definition of STANDARD_OBJECTS) {
        const existing = await tx.objectType.findFirst({
          where: { organizationId: ctx.organizationId, slug: definition.slug },
          select: { id: true },
        });
        if (existing) {
          continue;
        }
        const object = await tx.objectType.create({
          data: {
            organizationId: ctx.organizationId,
            slug: definition.slug,
            label: definition.label,
            pluralLabel: definition.pluralLabel,
            kind: 'STANDARD',
          },
        });
        await tx.fieldDefinition.createMany({
          data: definition.fields.map((field) => ({
            organizationId: ctx.organizationId,
            objectTypeId: object.id,
            name: field.name,
            label: field.label,
            type: field.type,
            required: field.required ?? false,
            isUnique: field.unique ?? false,
            filterable: field.filterable ?? false,
            maxLength: field.maxLength ?? null,
            config: field.options ? { options: field.options } : {},
          })),
        });
        created.push(definition.slug);
      }
      const objects = await tx.objectType.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { id: 'asc' },
      });
      return { created, results: objects.map((o) => objectDto(o)) };
    });
  }

  async addField(ctx: RequestContext, name: string, body: unknown) {
    assertCan(ctx, { object: ['manage'] }, 'change object fields');
    const input = parse(createFieldBody, body);
    if (input.type === 'ENUM' && !input.config?.options) {
      throw validationFailed([{ field: 'config.options', code: 'INVALID_FIELD', message: 'ENUM fields need config.options' }]);
    }

    return this.tenant(ctx, async (tx) => {
      const object = await this.loadObject(tx, ctx, name);
      if (object.fields.some((f) => f.name === input.name)) {
        throw conflict(`Field '${input.name}' already exists on '${name}'`);
      }
      if (input.required) {
        const existing = await tx.objectRecord.count({
          where: { organizationId: ctx.organizationId, objectTypeId: object.id, deletedAt: null },
        });
        if (existing > 0) {
          throw conflict('A required field cannot be added to an object that already has records');
        }
      }
      const field = await tx.fieldDefinition.create({
        data: {
          organizationId: ctx.organizationId,
          objectTypeId: object.id,
          name: input.name,
          label: input.label,
          type: input.type,
          required: input.required,
          isUnique: input.unique,
          filterable: input.filterable,
          readOnly: input.read_only,
          sensitive: input.sensitive,
          maxLength: input.max_length ?? null,
          config: input.config ?? {},
        },
      });
      await tx.objectType.update({ where: { id: object.id }, data: { version: { increment: 1 } } });
      return fieldDto(field);
    });
  }
}
