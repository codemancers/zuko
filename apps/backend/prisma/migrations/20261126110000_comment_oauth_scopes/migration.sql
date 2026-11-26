-- The MCP resource's allowed scopes are stored when it is first created, so a database that
-- already has it does not learn about new scopes from code. Let clients be granted the comment
-- scopes there too; existing approvals are untouched.
UPDATE "oauth_resource"
SET "allowedScopes" = "allowedScopes" || ARRAY(
  SELECT scope FROM unnest(ARRAY['comments:read', 'comments:write']) AS scope
  WHERE scope <> ALL("allowedScopes")
)
WHERE identifier ~ '^https?://[^/?#]+/eve/v1/mcp$';
