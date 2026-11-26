-- CreateTable
CREATE TABLE "record_change" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "record_id" BIGINT NOT NULL,
    "object_type_id" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" BIGINT,
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "record_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT,
    "actor_type" TEXT NOT NULL,
    "actor_id" BIGINT,
    "event" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" BIGINT,
    "metadata" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "record_change_organization_id_record_id_created_at_idx" ON "record_change"("organization_id", "record_id", "created_at");

-- CreateIndex
CREATE INDEX "record_change_organization_id_object_type_id_created_at_idx" ON "record_change"("organization_id", "object_type_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_event_organization_id_created_at_idx" ON "audit_event"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_event_organization_id_event_created_at_idx" ON "audit_event"("organization_id", "event", "created_at" DESC);

-- Allowed values
ALTER TABLE "record_change" ADD CONSTRAINT "record_change_action_check"
  CHECK ("action" IN ('CREATE', 'UPDATE', 'DELETE'));
ALTER TABLE "record_change" ADD CONSTRAINT "record_change_actor_type_check"
  CHECK ("actor_type" IN ('USER', 'API_KEY', 'SYSTEM', 'IMPORT', 'MCP', 'AGENT'));
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_type_check"
  CHECK ("actor_type" IN ('USER', 'API_KEY', 'SYSTEM', 'IMPORT', 'MCP', 'AGENT', 'ANONYMOUS'));

-- Tenant isolation. Events with no organization (e.g. a failed sign-in) can be written
-- but are never readable through a tenant context.
CALL enable_tenant_rls('"record_change"');
CALL enable_tenant_rls('"audit_event"', 'organization_id', true);

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
