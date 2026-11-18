-- CreateTable
CREATE TABLE "record_change" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "recordId" BIGINT NOT NULL,
    "objectTypeId" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" BIGINT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "record_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT,
    "actorType" TEXT NOT NULL,
    "actorId" BIGINT,
    "event" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" BIGINT,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "record_change_organizationId_recordId_createdAt_idx" ON "record_change"("organizationId", "recordId", "createdAt");

-- CreateIndex
CREATE INDEX "record_change_organizationId_objectTypeId_createdAt_idx" ON "record_change"("organizationId", "objectTypeId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_event_organizationId_createdAt_idx" ON "audit_event"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_event_organizationId_event_createdAt_idx" ON "audit_event"("organizationId", "event", "createdAt" DESC);

-- Allowed values
ALTER TABLE "record_change" ADD CONSTRAINT "record_change_action_check"
  CHECK ("action" IN ('CREATE', 'UPDATE', 'DELETE'));
ALTER TABLE "record_change" ADD CONSTRAINT "record_change_actorType_check"
  CHECK ("actorType" IN ('USER', 'API_KEY', 'SYSTEM', 'IMPORT', 'MCP'));
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actorType_check"
  CHECK ("actorType" IN ('USER', 'API_KEY', 'SYSTEM', 'IMPORT', 'MCP', 'ANONYMOUS'));

-- Tenant isolation. Events with no organization (e.g. a failed sign-in) can be written
-- but are never readable through a tenant context.
CALL enable_tenant_rls('"record_change"');
CALL enable_tenant_rls('"audit_event"', 'organizationId', true);

-- Append-only. The app role can only read and insert; the trigger also stops the
-- owner/login role, which is what better-auth's plain client uses. Retention jobs
-- may delete inside a transaction that sets app.audit_purge = 'on'.
REVOKE UPDATE, DELETE, TRUNCATE ON "record_change", "audit_event" FROM zuko_app;

CREATE FUNCTION audit_reject_mutation() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.audit_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END
$$;

CREATE TRIGGER record_change_append_only
  BEFORE UPDATE OR DELETE ON "record_change"
  FOR EACH ROW EXECUTE FUNCTION audit_reject_mutation();
CREATE TRIGGER audit_event_append_only
  BEFORE UPDATE OR DELETE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION audit_reject_mutation();
