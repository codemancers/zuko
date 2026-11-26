CREATE TABLE organization_setup (
  id BIGSERIAL PRIMARY KEY,
  "organization_id" BIGINT NOT NULL UNIQUE REFERENCES organization(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'ready', 'failed')),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt > 0),
  "run_id" TEXT,
  error TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc', now()),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc', now())
);
CALL enable_tenant_rls('organization_setup');

-- A server-owned reference lets the existing organization auth API locate the SDK stream.
ALTER TABLE organization ADD COLUMN "setup_run_id" TEXT;

-- Explicitly enqueue existing organizations for the same repeat-safe provisioning.
INSERT INTO organization_setup ("organization_id") SELECT id FROM organization;
