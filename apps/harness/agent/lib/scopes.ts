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
  list_comments: 'comments:read',
  get_record_activity: 'comments:read',
  add_comment: 'comments:write',
  update_comment: 'comments:write',
  delete_comment: 'comments:write',
  create_record: 'records:write',
  update_record: 'records:write',
  delete_record: 'records:delete',
  link_record: 'records:write',
  unlink_record: 'records:write',
  // Files follow the record or comment they belong to, so these use the record scopes.
  get_file: 'records:read',
  save_file: 'records:write',
  request_file_upload: 'records:write',
  list_record_files: 'records:read',
  // Enrichment writes to the record, so it needs the write scope (and the backend checks the role may enrich).
  enrich_record: 'records:write',
};
