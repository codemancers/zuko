CREATE TABLE organization_setup (
  id BIGSERIAL PRIMARY KEY,
  "organizationId" BIGINT NOT NULL UNIQUE REFERENCES organization(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'ready', 'failed')),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt > 0),
  "runId" TEXT,
  error TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc', now()),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc', now())
);
CALL enable_tenant_rls('organization_setup');

-- Explicitly enqueue existing organizations for the same repeat-safe provisioning.
INSERT INTO organization_setup ("organizationId") SELECT id FROM organization;
