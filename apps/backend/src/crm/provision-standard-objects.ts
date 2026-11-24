import type { TenantTransaction } from '../prisma/prisma.service';
import { STANDARD_ASSOCIATIONS, STANDARD_OBJECTS } from './standard-objects';

/** Create missing standard definitions inside the caller's tenant transaction. */
export async function provisionStandardObjects(tx: TenantTransaction, organizationId: bigint) {
  // Two requests setting up the same organization at once (two tabs, a double render)
  // would both find nothing and both try to create. Take turns instead: the second one
  // then sees what the first one made and creates nothing.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`standard-objects:${organizationId}`}))`;
  const created: string[] = [];
  for (const definition of STANDARD_OBJECTS) {
    const existing = await tx.objectType.findFirst({
      where: { organizationId, slug: definition.slug },
      select: { id: true },
    });
    if (existing) {
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
      data: definition.fields.map((field) => ({
        organizationId,
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
          config: { link: pair.name, target: pair.target, many: true },
        },
      });
    }
  }
  return created;
}
