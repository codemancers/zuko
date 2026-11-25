-- A server-owned reference lets the existing organization auth API locate the SDK stream.
ALTER TABLE organization ADD COLUMN "setupRunId" TEXT;
UPDATE organization o SET "setupRunId" = s."runId"
FROM organization_setup s WHERE s."organizationId" = o.id;
