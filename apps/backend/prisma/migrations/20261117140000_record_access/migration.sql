-- CreateTable
CREATE TABLE "role_object_access" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "role" TEXT NOT NULL,
    "object_type_id" BIGINT,
    "read_scope" TEXT NOT NULL,
    "write_scope" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_object_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_share" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "record_id" BIGINT NOT NULL,
    "user_id" BIGINT,
    "team_id" BIGINT,
    "access" TEXT NOT NULL,
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "record_share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_object_access_organization_id_role_object_type_id_key" ON "role_object_access"("organization_id", "role", "object_type_id");

-- CreateIndex
CREATE INDEX "record_share_organization_id_record_id_idx" ON "record_share"("organization_id", "record_id");

-- CreateIndex
CREATE INDEX "record_share_organization_id_user_id_idx" ON "record_share"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "record_share_organization_id_team_id_idx" ON "record_share"("organization_id", "team_id");

-- AddForeignKey
ALTER TABLE "role_object_access" ADD CONSTRAINT "role_object_access_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_object_access" ADD CONSTRAINT "role_object_access_object_type_id_fkey" FOREIGN KEY ("object_type_id") REFERENCES "object_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_share" ADD CONSTRAINT "record_share_organization_id_record_id_fkey" FOREIGN KEY ("organization_id", "record_id") REFERENCES "object_record"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_share" ADD CONSTRAINT "record_share_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_share" ADD CONSTRAINT "record_share_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Allowed values
ALTER TABLE "role_object_access" ADD CONSTRAINT "role_object_access_read_scope_check"
  CHECK ("read_scope" IN ('OWN', 'OWN_AND_REPORTS', 'TEAM', 'ALL'));
ALTER TABLE "role_object_access" ADD CONSTRAINT "role_object_access_write_scope_check"
  CHECK ("write_scope" IN ('OWN', 'OWN_AND_REPORTS', 'TEAM', 'ALL'));
ALTER TABLE "record_share" ADD CONSTRAINT "record_share_access_check"
  CHECK ("access" IN ('READ', 'WRITE'));
ALTER TABLE "record_share" ADD CONSTRAINT "record_share_target_check"
  CHECK (("user_id" IS NULL) <> ("team_id" IS NULL));

-- NULLs are distinct in a unique index, so the "every object type" row (object_type_id
-- IS NULL) needs its own uniqueness rule next to the per-object one Prisma created.
CREATE UNIQUE INDEX "role_object_access_default_key"
  ON "role_object_access"("organization_id", "role") WHERE "object_type_id" IS NULL;

-- A record is shared with a given user or team at most once.
CREATE UNIQUE INDEX "record_share_user_key"
  ON "record_share"("organization_id", "record_id", "user_id") WHERE "user_id" IS NOT NULL;
CREATE UNIQUE INDEX "record_share_team_key"
  ON "record_share"("organization_id", "record_id", "team_id") WHERE "team_id" IS NOT NULL;

-- Everything a row points at must belong to the row's organization. Plain foreign
-- keys cannot say that for these optional links, so triggers do.
CREATE FUNCTION role_object_access_same_organization() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."object_type_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "object_type"
    WHERE "id" = NEW."object_type_id" AND "organization_id" = NEW."organization_id"
  ) THEN
    RAISE EXCEPTION 'object type % does not belong to organization %', NEW."object_type_id", NEW."organization_id"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER role_object_access_same_organization
  BEFORE INSERT OR UPDATE OF "object_type_id", "organization_id" ON "role_object_access"
  FOR EACH ROW EXECUTE FUNCTION role_object_access_same_organization();

CREATE FUNCTION record_share_same_organization() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."team_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "team" WHERE "id" = NEW."team_id" AND "organization_id" = NEW."organization_id"
  ) THEN
    RAISE EXCEPTION 'team % does not belong to organization %', NEW."team_id", NEW."organization_id"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NEW."user_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "member" WHERE "user_id" = NEW."user_id" AND "organization_id" = NEW."organization_id"
  ) THEN
    RAISE EXCEPTION 'user % is not a member of organization %', NEW."user_id", NEW."organization_id"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER record_share_same_organization
  BEFORE INSERT OR UPDATE OF "team_id", "user_id", "organization_id" ON "record_share"
  FOR EACH ROW EXECUTE FUNCTION record_share_same_organization();

-- Tenant isolation (see the tenancy_foundation migration)
CALL enable_tenant_rls('"role_object_access"');
CALL enable_tenant_rls('"record_share"');
