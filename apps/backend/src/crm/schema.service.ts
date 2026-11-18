import { Injectable } from '@nestjs/common';
import * as z from 'zod';
import type { AssociationDefinition, FieldDefinition, ObjectType } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService, type TenantTransaction } from '../prisma/prisma.service';
import type { RequestContext } from './context';
import { conflict, notFound, parse, validationFailed } from './errors';
import { FIELD_TYPES } from './field-types';
import { assertCan } from './permissions';
import { STANDARD_ASSOCIATIONS, STANDARD_OBJECTS } from './standard-objects';

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
  config: z
    .object({
      options: z.array(z.string().min(1)).min(1).optional(),
      // LINK: the kind of record it points at. LINK and USER: whether it holds one or many.
      target: slug.optional(),
      many: z.boolean().optional(),
    })
    .optional(),
});

// What may change on a field once it exists. The key and type may not (values are stored under
// the key, in the shape of the type), nor may uniqueness, which could not be checked retroactively.
const updateFieldBody = z
  .object({
    label: z.string().min(1).max(100),
    required: z.boolean(),
    filterable: z.boolean(),
    config: z.object({ options: z.array(z.string().min(1)).min(1), many: z.boolean() }).partial().strict(),
  })
  .partial()
  .strict();

const associationDefinitionDto = (d: AssociationDefinition & { sourceObjectType: ObjectType; targetObjectType: ObjectType }, fieldLabel: string) => ({
  id: String(d.id),
  name: d.name,
  label: fieldLabel,
  many: d.many,
  source: { name: d.sourceObjectType.slug, label: d.sourceObjectType.label },
  target: { name: d.targetObjectType.slug, label: d.targetObjectType.label },
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

export interface AssociationDto {
  /** The link's name, as used in the association URLs. */
  name: string;
  /** The column's heading: the field's label on the object that holds it, what its owner says on the other. */
  label: string;
  /** What one linked record is: the other object's label. */
  singular_label: string;
  /** The other object's name. */
  target: string;
  /** Whether a record here can be linked to many, or only one. A reverse side is always many. */
  many: boolean;
  /** `forward` on the object that holds the link field; `reverse` on the one it points at. */
  side: 'forward' | 'reverse';
  /** The field's key, on the object that holds it. */
  field: string | null;
}

export const objectDto = (o: ObjectType, fields?: FieldDefinition[], associations?: AssociationDto[]) => ({
  id: String(o.id),
  name: o.slug,
  label: o.label,
  plural_label: o.pluralLabel,
  object_kind: o.kind,
  version: o.version,
  ...(fields ? { fields: fields.map(fieldDto) } : {}),
  ...(associations ? { associations } : {}),
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
    return this.tenant(ctx, async (tx) => {
      const objects = await tx.objectType.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { id: 'asc' } });
      const counts = await tx.fieldDefinition.groupBy({
        by: ['objectTypeId'],
        where: { organizationId: ctx.organizationId, deletedAt: null },
        _count: { _all: true },
      });
      const fieldCount = new Map(counts.map((c) => [c.objectTypeId, c._count._all]));
      return { results: objects.map((o) => ({ ...objectDto(o), field_count: fieldCount.get(o.id) ?? 0 })) };
    });
  }

  /** The links between kinds of record, as the link fields that make them. */
  async listAssociations(ctx: RequestContext) {
    assertCan(ctx, { record: ['read'] }, 'view object types');
    return this.tenant(ctx, async (tx) => {
      const defs = await tx.associationDefinition.findMany({
        where: { organizationId: ctx.organizationId, isActive: true },
        include: { sourceObjectType: true, targetObjectType: true },
        orderBy: { id: 'asc' },
      });
      const results = [];
      for (const d of defs) {
        const field = await tx.fieldDefinition.findFirst({
          where: { organizationId: ctx.organizationId, objectTypeId: d.sourceObjectTypeId, deletedAt: null, config: { path: ['link'], equals: d.name } },
        });
        if (field) results.push(associationDefinitionDto(d, field.label));
      }
      return { results };
    });
  }

  async describe(ctx: RequestContext, name: string) {
    assertCan(ctx, { record: ['read'] }, 'view object types');
    return this.tenant(ctx, async (tx) => {
      const object = await this.loadObject(tx, ctx, name);
      // Which other kinds of record this one can be linked to.
      const defs = await tx.associationDefinition.findMany({
        where: {
          organizationId: ctx.organizationId,
          isActive: true,
          OR: [{ sourceObjectTypeId: object.id }, { targetObjectTypeId: object.id }],
        },
        include: { sourceObjectType: true, targetObjectType: true },
        orderBy: { id: 'asc' },
      });
      // Each link as this object sees it: its own field's label when it holds the field, else what the field's owner says.
      const associations: AssociationDto[] = [];
      for (const d of defs) {
        const forward = d.sourceObjectTypeId === object.id;
        const sourceField = await tx.fieldDefinition.findFirst({
          where: { organizationId: ctx.organizationId, objectTypeId: d.sourceObjectTypeId, deletedAt: null, config: { path: ['link'], equals: d.name } },
        });
        if (!sourceField) continue;
        const other = forward ? d.targetObjectType : d.sourceObjectType;
        associations.push({
          name: d.name,
          label: forward ? sourceField.label : (d.reverseLabel ?? `${d.sourceObjectType.pluralLabel} (${sourceField.label})`),
          singular_label: other.label,
          target: other.slug,
          many: forward ? d.many : true,
          side: forward ? 'forward' : 'reverse',
          field: forward ? sourceField.name : null,
        });
      }
      return objectDto(object, object.fields, associations);
    });
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
      // The links between them, for whichever pairs now exist.
      const bySlug = new Map(
        (await tx.objectType.findMany({ where: { organizationId: ctx.organizationId }, select: { id: true, slug: true } })).map((o) => [o.slug, o.id]),
      );
      for (const pair of STANDARD_ASSOCIATIONS) {
        const source = bySlug.get(pair.source);
        const target = bySlug.get(pair.target);
        if (source === undefined || target === undefined) {
          continue;
        }
        await tx.associationDefinition.upsert({
          where: { organizationId_name: { organizationId: ctx.organizationId, name: pair.name } },
          create: {
            organizationId: ctx.organizationId,
            name: pair.name,
            label: pair.label,
            sourceObjectTypeId: source,
            targetObjectTypeId: target,
            reverseLabel: pair.reverseLabel,
            isDefault: true,
          },
          update: {},
        });
        // The link is a field on the source object, unless one by that key is there already (even a removed one).
        const taken = await tx.fieldDefinition.findFirst({
          where: { organizationId: ctx.organizationId, objectTypeId: source, name: pair.field },
          select: { id: true },
        });
        if (!taken) {
          await tx.fieldDefinition.create({
            data: {
              organizationId: ctx.organizationId,
              objectTypeId: source,
              name: pair.field,
              label: pair.fieldLabel,
              type: 'LINK',
              config: { link: pair.name, target: pair.target, many: true },
            },
          });
        }
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
    if (input.type === 'LINK') {
      if (!input.config?.target) {
        throw validationFailed([{ field: 'config.target', code: 'INVALID_FIELD', message: 'LINK fields need config.target, the object they point at' }]);
      }
      if (input.required || input.unique) {
        throw validationFailed([{ field: 'required', code: 'INVALID_FIELD', message: 'A link cannot be required or unique' }]);
      }
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
      let config: Record<string, unknown> = input.config ?? {};
      let filterable = input.filterable;
      if (input.type === 'LINK') {
        const target = await this.loadObject(tx, ctx, input.config!.target!);
        if (target.id === object.id) {
          throw validationFailed([{ field: 'config.target', code: 'INVALID_FIELD', message: 'A link must point at a different object' }]);
        }
        const link = `${object.slug}_${input.name}`.slice(0, 120);
        const many = input.config?.many ?? true;
        const previous = removed ? await tx.associationDefinition.findFirst({ where: { organizationId: ctx.organizationId, name: link } }) : null;
        if (previous) {
          // Adding a removed link back: it must point at what it did, so its old links mean the same.
          if (previous.targetObjectTypeId !== target.id) {
            throw conflict(`Field '${input.name}' was removed as a link to another object; add it again with that target, or use another key`);
          }
          await tx.associationDefinition.update({ where: { id: previous.id }, data: { isActive: true, many, label: input.label } });
        } else {
          if (await tx.associationDefinition.findFirst({ where: { organizationId: ctx.organizationId, name: link }, select: { id: true } })) {
            throw conflict(`A link named '${link}' already exists`);
          }
          await tx.associationDefinition.create({
            data: { organizationId: ctx.organizationId, name: link, label: input.label, sourceObjectTypeId: object.id, targetObjectTypeId: target.id, many },
          });
        }
        config = { link, target: target.slug, many };
        filterable = false;
      } else if (input.type === 'USER') {
        const many = input.config?.many ?? false;
        config = { many };
        filterable = many ? false : input.filterable; // a list of members cannot be filtered like a single value
      }
      const data = {
        label: input.label,
        required: input.required,
        isUnique: input.unique,
        filterable,
        readOnly: input.read_only,
        sensitive: input.sensitive,
        maxLength: input.max_length ?? null,
        config: config as Prisma.InputJsonObject,
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

      const current = (field.config ?? {}) as { many?: boolean; link?: string; options?: string[] };
      let config: Record<string, unknown> | undefined;
      let filterable = input.filterable;

      // A link's values live in associations, not in the record's properties, so it can be neither
      // required (every create would fail, since a link cannot be set while creating) nor searched.
      // A field holding several members stores a list, which a search on one value cannot match.
      if (field.type === 'LINK' && (input.required === true || input.filterable === true)) {
        throw validationFailed([
          {
            field: input.required === true ? 'required' : 'filterable',
            code: 'INVALID_FIELD',
            message: `'${fieldName}' is a link, and a link cannot be required or searched`,
          },
        ]);
      }
      if (field.type === 'USER' && input.filterable === true && (input.config?.many ?? current.many === true)) {
        throw validationFailed([{ field: 'filterable', code: 'INVALID_FIELD', message: `'${fieldName}' holds several members, and such a field cannot be searched` }]);
      }

      if (input.config?.options) {
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
        config = { ...current, options: input.config.options };
      }

      if (input.config?.many !== undefined) {
        if (field.type !== 'LINK' && field.type !== 'USER') {
          throw validationFailed([{ field: 'config.many', code: 'INVALID_FIELD', message: `Only a link or user field holds one or many, and '${fieldName}' is ${field.type}` }]);
        }
        const many = input.config.many;
        if ((current.many === true) !== many) {
          if (field.type === 'LINK') {
            if (!many) {
              const crowded = await tx.$queryRaw<{ n: bigint }[]>`
                SELECT count(*) AS n FROM (
                  SELECT "sourceId" FROM association
                  WHERE "organizationId" = ${ctx.organizationId} AND "definitionId" = (
                    SELECT "id" FROM association_definition WHERE "organizationId" = ${ctx.organizationId} AND "name" = ${current.link ?? ''})
                  GROUP BY "sourceId" HAVING count(*) > 1) crowded`;
              const n = Number(crowded[0]?.n ?? 0);
              if (n > 0) {
                throw conflict(`${n} records are linked to more than one; keep one on each before allowing only one`);
              }
            }
            await tx.associationDefinition.updateMany({ where: { organizationId: ctx.organizationId, name: current.link ?? '' }, data: { many } });
          } else if (many) {
            // One member becomes a list of one.
            await tx.$executeRaw`
              UPDATE object_record SET "properties" = jsonb_set("properties", ARRAY[${fieldName}], jsonb_build_array("properties"->${fieldName}))
              WHERE "organizationId" = ${ctx.organizationId} AND "objectTypeId" = ${object.id} AND jsonb_typeof("properties"->${fieldName}) = 'string'`;
            filterable = false;
          } else {
            const crowded = await tx.$queryRaw<{ n: bigint }[]>`
              SELECT count(*) AS n FROM object_record
              WHERE "organizationId" = ${ctx.organizationId} AND "objectTypeId" = ${object.id} AND "deletedAt" IS NULL
                AND jsonb_typeof("properties"->${fieldName}) = 'array' AND jsonb_array_length("properties"->${fieldName}) > 1`;
            const n = Number(crowded[0]?.n ?? 0);
            if (n > 0) {
              throw conflict(`${n} records have several members here; keep one on each before allowing only one`);
            }
            await tx.$executeRaw`
              UPDATE object_record SET "properties" = CASE WHEN jsonb_array_length("properties"->${fieldName}) = 0
                THEN "properties" - ${fieldName} ELSE jsonb_set("properties", ARRAY[${fieldName}], "properties"->${fieldName}->0) END
              WHERE "organizationId" = ${ctx.organizationId} AND "objectTypeId" = ${object.id} AND jsonb_typeof("properties"->${fieldName}) = 'array'`;
          }
        }
        config = { ...(config ?? current), many };
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
          ...(filterable !== undefined ? { filterable } : {}),
          ...(config ? { config: config as Prisma.InputJsonObject } : {}),
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
      if (field.type === 'LINK') {
        // The links stay stored, hidden, and come back with the field.
        await tx.associationDefinition.updateMany({
          where: { organizationId: ctx.organizationId, name: (field.config as { link?: string } | null)?.link ?? '' },
          data: { isActive: false },
        });
      }
      await tx.objectType.update({ where: { id: object.id }, data: { version: { increment: 1 } } });
      return { name: fieldName, deleted: true };
    });
  }
}
