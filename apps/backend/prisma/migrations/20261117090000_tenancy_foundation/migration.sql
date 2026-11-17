-- Tenancy foundation: row-level security keyed on the "organizationId" column.
--
-- Requests run inside a transaction that does
--   SET LOCAL ROLE zuko_app;  SELECT set_config('app.org_id', '<id>', true);
-- so policies apply even when the login role is a superuser / owner. An unset
-- app.org_id yields NULL, which matches no rows (fail closed).

-- Runtime role. NOLOGIN: the login role switches into it per transaction.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'zuko_app') THEN
    CREATE ROLE zuko_app NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

-- Let the migration/login role switch into it. Other login roles that run the app
-- need the same grant: GRANT zuko_app TO <login_role>;
GRANT zuko_app TO CURRENT_USER;

GRANT USAGE ON SCHEMA public TO zuko_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zuko_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO zuko_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO zuko_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO zuko_app;

-- Current tenant, or NULL when no tenant context is set.
CREATE OR REPLACE FUNCTION app_org_id() RETURNS bigint
  LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.org_id', true), '')::bigint $$;

-- Current actor (user id), or NULL.
CREATE OR REPLACE FUNCTION app_actor_id() RETURNS bigint
  LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.actor_id', true), '')::bigint $$;

-- Turn on tenant isolation for a table.
--   org_column          column holding the tenant id (default "organizationId")
--   allow_global_insert also allow inserting rows with a NULL tenant (e.g. audit
--                       events with no organization). Such rows are never readable
--                       through a tenant context.
CREATE OR REPLACE PROCEDURE enable_tenant_rls(
  tbl regclass,
  org_column name DEFAULT 'organizationId',
  allow_global_insert boolean DEFAULT false
)
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tbl);

  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %s', tbl);
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %s
       USING (%I = app_org_id()) WITH CHECK (%I = app_org_id())',
    tbl, org_column, org_column);

  EXECUTE format('DROP POLICY IF EXISTS tenant_global_insert ON %s', tbl);
  IF allow_global_insert THEN
    EXECUTE format(
      'CREATE POLICY tenant_global_insert ON %s FOR INSERT WITH CHECK (%I IS NULL)',
      tbl, org_column);
  END IF;
END
$$;
