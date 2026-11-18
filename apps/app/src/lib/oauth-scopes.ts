/** What each scope an MCP client can hold means, in plain words. */
export const SCOPE_LABELS: Record<string, string> = {
  'mcp:read': 'View records and how your data is set up',
  'mcp:write': 'Create and change records',
  'mcp:delete': 'Delete records',
  offline_access: 'Stay connected without asking you again',
  openid: 'Know who you are',
};

/** The scopes worth showing a person: identity plumbing is implied by being connected at all. */
export const describeScopes = (scopes: string[]) =>
  scopes.filter((scope) => scope.startsWith('mcp:')).map((scope) => SCOPE_LABELS[scope] ?? scope);
