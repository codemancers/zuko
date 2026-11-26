import { createAccessControl, type AccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements, memberAc, ownerAc } from 'better-auth/plugins/organization/access';

/**
 * What a role is allowed to do at all (capabilities). Which records an action may
 * touch (own / own_and_reports / team / all) is decided separately, per role and
 * object type, by the record access scope. Object types are created at runtime, so
 * they cannot appear as statement keys.
 */
export const statement = {
  ...defaultStatements,
  // Work with records of any object type.
  record: ['read', 'create', 'update', 'delete', 'export', 'enrich'],
  // Connect or disconnect third-party services (Apollo) for the organization.
  integration: ['manage'],
  // Comment on records the member can see; `moderate` removes anyone's comment, not only their own.
  comment: ['create', 'moderate'],
  // Create or change object types and their fields (the schema, not the data).
  object: ['manage'],
} as const;

// Annotated explicitly: left to inference, the emitted declaration flattens this into
// an object type that better-auth's organization({ ac }) option rejects.
export const ac: AccessControl<typeof statement> = createAccessControl(statement);

const allRecordActions = ['read', 'create', 'update', 'delete', 'export', 'enrich'] as const;

export const owner = ac.newRole({
  ...ownerAc.statements,
  record: [...allRecordActions],
  comment: ['create', 'moderate'],
  object: ['manage'],
  integration: ['manage'],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  record: [...allRecordActions],
  comment: ['create', 'moderate'],
  object: ['manage'],
  integration: ['manage'],
});

// Members work with records but cannot delete or export them, or change the schema.
export const member = ac.newRole({
  ...memberAc.statements,
  record: ['read', 'create', 'update', 'enrich'],
  comment: ['create'],
});

export const roles = { owner, admin, member };
