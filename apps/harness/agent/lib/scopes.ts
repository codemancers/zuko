/** OAuth scopes describe domain access; each tool requests only the resource it uses. */
export const toolScopes: Readonly<Record<string, string>> = {
  list_object_types: 'schema:read',
  describe_object_type: 'schema:read',
  list_members: 'directory:read',
  list_teams: 'directory:read',
  list_records: 'records:read',
  filter_records: 'records:read',
  get_record: 'records:read',
  get_record_history: 'records:read',
  list_linked_records: 'records:read',
  create_record: 'records:write',
  update_record: 'records:write',
  delete_record: 'records:delete',
  link_record: 'records:write',
  unlink_record: 'records:write',
};
