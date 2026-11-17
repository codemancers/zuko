import { Injectable } from '@nestjs/common';
import * as z from 'zod';
import type { FieldDefinition, ObjectType } from '../generated/prisma/client';
import { PrismaService, type TenantTransaction } from '../prisma/prisma.service';
import type { RequestContext } from './context';
import { conflict, notFound, parse, validationFailed } from './errors';
import { FIELD_TYPES } from './field-types';
import { assertCan } from './permissions';
import { STANDARD_OBJECTS } from './standard-objects';

/**
 * An object with its current fields. The fields that were removed are kept apart: they are not part of
 * the object any more, but their values stay stored, so what is known about them (that a field was
 * sensitive, say) still matters.
 */
export type ObjectWithFields = ObjectType & { fields: FieldDefinition[]; removedFields: FieldDefinition[] };

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

// What may change on a field once it exists. The key and type may not (values are stored under
// the key, in the shape of the type), nor may uniqueness, which could not be checked retroactively.
const updateFieldBody = z
  .object({
    label: z.string().min(1).max(100),
    required: z.boolean(),
    filterable: z.boolean(),
    config: z.object({ options: z.array(z.string().min(1)).min(1) }),
  })
  .partial()
  .strict();

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
    const { fields, ...rest } = object;
    return { ...rest, fields: fields.filter((f) => f.deletedAt === null), removedFields: fields.filter((f) => f.deletedAt !== null) };
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
      // A field that was removed keeps its key, and the values stored under it. Adding it
      // again brings them back, as long as the type still fits them.
      const removed = await tx.fieldDefinition.findFirst({
        where: { organizationId: ctx.organizationId, objectTypeId: object.id, name: input.name, deletedAt: { not: null } },
      });
      if (removed && removed.type !== input.type) {
        throw conflict(`Field '${input.name}' was removed as ${removed.type}; add it again as ${removed.type}, or use another key`);
      }
      if (input.required) {
        const existing = await tx.objectRecord.count({
          where: { organizationId: ctx.organizationId, objectTypeId: object.id, deletedAt: null },
        });
        if (existing > 0) {
          throw conflict('A required field cannot be added to an object that already has records');
        }
      }
      const data = {
        label: input.label,
        required: input.required,
        isUnique: input.unique,
        filterable: input.filterable,
        readOnly: input.read_only,
        sensitive: input.sensitive,
        maxLength: input.max_length ?? null,
        config: input.config ?? {},
      };
      const field = removed
        ? await tx.fieldDefinition.update({ where: { id: removed.id }, data: { ...data, deletedAt: null } })
        : await tx.fieldDefinition.create({
            data: { organizationId: ctx.organizationId, objectTypeId: object.id, name: input.name, type: input.type, ...data },
          });
      await tx.objectType.update({ where: { id: object.id }, data: { version: { increment: 1 } } });
      return fieldDto(field);
    });
  }

  /** Change a field's label, whether it is searchable, whether it is required, or a choice field's options. */
  async updateField(ctx: RequestContext, name: string, fieldName: string, body: unknown) {
    assertCan(ctx, { object: ['manage'] }, 'change object fields');
    const input = parse(updateFieldBody, body);

    return this.tenant(ctx, async (tx) => {
      const object = await this.loadObject(tx, ctx, name);
      const field = object.fields.find((f) => f.name === fieldName);
      if (!field) {
        throw notFound(`Field '${fieldName}' does not exist on '${name}'`);
      }

      if (input.config) {
        if (field.type !== 'ENUM') {
          throw validationFailed([{ field: 'config.options', code: 'INVALID_FIELD', message: `Only a choice field has options, and '${fieldName}' is ${field.type}` }]);
        }
        const kept = new Set(input.config.options);
        const used = await tx.$queryRaw<{ value: string }[]>`
          SELECT DISTINCT "properties"->>${fieldName} AS value FROM object_record
          WHERE "organizationId" = ${ctx.organizationId} AND "objectTypeId" = ${object.id} AND "deletedAt" IS NULL
            AND "properties"->>${fieldName} IS NOT NULL`;
        const stranded = used.map((row) => row.value).filter((value) => !kept.has(value));
        if (stranded.length > 0) {
          throw conflict(`Records still use ${stranded.map((v) => `'${v}'`).join(', ')}; change them before removing the choice`);
        }
      }

      if (input.required === true && !field.required) {
        const missing = await tx.$queryRaw<{ n: bigint }[]>`
          SELECT count(*) AS n FROM object_record
          WHERE "organizationId" = ${ctx.organizationId} AND "objectTypeId" = ${object.id} AND "deletedAt" IS NULL
            AND ("properties"->>${fieldName} IS NULL OR "properties"->>${fieldName} = '')`;
        if (Number(missing[0]?.n ?? 0) > 0) {
          throw conflict(`${missing[0].n} records have no ${field.label}; fill it in before making it required`);
        }
      }

      const updated = await tx.fieldDefinition.update({
        where: { id: field.id },
        data: {
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.required !== undefined ? { required: input.required } : {}),
          ...(input.filterable !== undefined ? { filterable: input.filterable } : {}),
          ...(input.config ? { config: input.config } : {}),
        },
      });
      await tx.objectType.update({ where: { id: object.id }, data: { version: { increment: 1 } } });
      return fieldDto(updated);
    });
  }

  /** Remove a field. Its values stay stored, and come back if a field with the same key and type is added again. */
  async removeField(ctx: RequestContext, name: string, fieldName: string) {
    assertCan(ctx, { object: ['manage'] }, 'change object fields');
    return this.tenant(ctx, async (tx) => {
      const object = await this.loadObject(tx, ctx, name);
      const field = object.fields.find((f) => f.name === fieldName);
      if (!field) {
        throw notFound(`Field '${fieldName}' does not exist on '${name}'`);
      }
      await tx.fieldDefinition.update({ where: { id: field.id }, data: { deletedAt: new Date() } });
      await tx.objectType.update({ where: { id: object.id }, data: { version: { increment: 1 } } });
      return { name: fieldName, deleted: true };
    });
  }
}
