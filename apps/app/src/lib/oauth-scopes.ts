/** What each scope an MCP client can hold means, in plain words. */
export const SCOPE_LABELS: Record<string, string> = {
  'agent:invoke': 'Start and manage work with the Zuko agent',
  'records:read': 'View records, their relationships, change history and attached files',
  'records:write': 'Create and change records, and upload and attach files',
  'records:delete': 'Delete records',
  'comments:read': 'View comments on records, and the timeline of changes they appear in',
  'comments:write': 'Add, edit and delete your comments on records',
  'schema:read': 'View object types, fields and relationship definitions',
  'directory:read': 'View organization members and teams',
  offline_access: 'Stay connected without asking you again',
  openid: 'Know who you are',
};

/** The scopes worth showing a person: identity plumbing is implied by being connected at all. */
export const describeScopes = (scopes: string[]) =>
  scopes
    .filter(
      (scope) =>
        ['records:', 'schema:', 'directory:', 'files:', 'comments:'].some((prefix) => scope.startsWith(prefix)) ||
        scope === 'agent:invoke',
    )
    .map((scope) => SCOPE_LABELS[scope] ?? scope);
