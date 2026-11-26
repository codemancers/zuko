import type { TenantTransaction } from '../prisma/prisma.service';
import { STANDARD_ASSOCIATIONS, STANDARD_OBJECTS, type StandardField } from './standard-objects';
export class StandardObjectConflict extends Error {}

const fieldData = (organizationId: bigint, objectTypeId: bigint, field: StandardField) => ({
  organizationId,
  objectTypeId,
  name: field.name,
  label: field.label,
  type: field.type,
  required: field.required ?? false,
  isUnique: field.unique ?? false,
  filterable: field.filterable ?? false,
  maxLength: field.maxLength ?? null,
  config: field.options ? { options: field.options } : {},
});

/** Provision missing CRM definitions without overwriting organization customizations. */
export async function provisionStandardObjects(tx: TenantTransaction, organizationId: bigint) {
  // Serialize duplicate workflow deliveries before checking which definitions exist.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`standard-objects:${organizationId}`}))`;
  const created: string[] = [];
  for (const definition of STANDARD_OBJECTS) {
    const existing = await tx.objectType.findFirst({
      where: { organizationId, slug: definition.slug },
      select: { id: true, kind: true },
    });
    if (existing) {
      if (existing.kind !== 'STANDARD')
        throw new StandardObjectConflict(
          `The object key ${definition.slug} is already used by a custom object. Resolve this conflict before retrying setup.`,
        );
      // Fields added to the standard definition later. A field that exists under that key (even a
      // removed or changed one) is the organization's to keep.
      const present = new Set(
        (
          await tx.fieldDefinition.findMany({
            where: { organizationId, objectTypeId: existing.id },
            select: { name: true },
          })
        ).map((f) => f.name),
      );
      const missing = definition.fields.filter((field) => !present.has(field.name));
      if (missing.length) {
        await tx.fieldDefinition.createMany({
          data: missing.map((field) => fieldData(organizationId, existing.id, field)),
        });
      }
      continue;
    }
    const object = await tx.objectType.create({
      data: {
        organizationId,
        slug: definition.slug,
        label: definition.label,
        pluralLabel: definition.pluralLabel,
        kind: 'STANDARD',
      },
    });
    await tx.fieldDefinition.createMany({
      data: definition.fields.map((field) => fieldData(organizationId, object.id, field)),
    });
    created.push(definition.slug);
  }
  // The links between them, for whichever pairs now exist.
  const bySlug = new Map(
    (
      await tx.objectType.findMany({
        where: { organizationId },
        select: { id: true, slug: true },
      })
    ).map((o) => [o.slug, o.id]),
  );
  for (const pair of STANDARD_ASSOCIATIONS) {
    const source = bySlug.get(pair.source);
    const target = bySlug.get(pair.target);
    if (source === undefined || target === undefined) {
      continue;
    }
    await tx.associationDefinition.upsert({
      where: { organizationId_name: { organizationId, name: pair.name } },
      create: {
        organizationId,
        name: pair.name,
        label: pair.label,
        sourceObjectTypeId: source,
        targetObjectTypeId: target,
        reverseLabel: pair.reverseLabel,
        many: pair.many ?? true,
        isDefault: true,
      },
      update: {},
    });
    // The link is a field on the source object, unless one by that key is there already (even a removed one).
    const taken = await tx.fieldDefinition.findFirst({
      where: { organizationId, objectTypeId: source, name: pair.field },
      select: { id: true },
    });
    if (!taken) {
      await tx.fieldDefinition.create({
        data: {
          organizationId,
          objectTypeId: source,
          name: pair.field,
          label: pair.fieldLabel,
          type: 'LINK',
          config: { link: pair.name, target: pair.target, many: pair.many ?? true },
        },
      });
    }
  }
  return created;
}
