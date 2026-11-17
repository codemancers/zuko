-- CreateTable
CREATE TABLE "role_object_access" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "role" TEXT NOT NULL,
    "objectTypeId" BIGINT,
    "readScope" TEXT NOT NULL,
    "writeScope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_object_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_share" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "recordId" BIGINT NOT NULL,
    "userId" BIGINT,
    "teamId" BIGINT,
    "access" TEXT NOT NULL,
    "createdBy" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_object_access_organizationId_role_objectTypeId_key" ON "role_object_access"("organizationId", "role", "objectTypeId");

-- CreateIndex
CREATE INDEX "record_share_organizationId_recordId_idx" ON "record_share"("organizationId", "recordId");

-- CreateIndex
CREATE INDEX "record_share_organizationId_userId_idx" ON "record_share"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "record_share_organizationId_teamId_idx" ON "record_share"("organizationId", "teamId");

-- AddForeignKey
ALTER TABLE "role_object_access" ADD CONSTRAINT "role_object_access_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_object_access" ADD CONSTRAINT "role_object_access_objectTypeId_fkey" FOREIGN KEY ("objectTypeId") REFERENCES "object_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_share" ADD CONSTRAINT "record_share_organizationId_recordId_fkey" FOREIGN KEY ("organizationId", "recordId") REFERENCES "object_record"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_share" ADD CONSTRAINT "record_share_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_share" ADD CONSTRAINT "record_share_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Allowed values
ALTER TABLE "role_object_access" ADD CONSTRAINT "role_object_access_readScope_check"
  CHECK ("readScope" IN ('OWN', 'OWN_AND_REPORTS', 'TEAM', 'ALL'));
ALTER TABLE "role_object_access" ADD CONSTRAINT "role_object_access_writeScope_check"
  CHECK ("writeScope" IN ('OWN', 'OWN_AND_REPORTS', 'TEAM', 'ALL'));
ALTER TABLE "record_share" ADD CONSTRAINT "record_share_access_check"
  CHECK ("access" IN ('READ', 'WRITE'));
ALTER TABLE "record_share" ADD CONSTRAINT "record_share_target_check"
  CHECK (("userId" IS NULL) <> ("teamId" IS NULL));

-- NULLs are distinct in a unique index, so the "every object type" row (objectTypeId
-- IS NULL) needs its own uniqueness rule next to the per-object one Prisma created.
CREATE UNIQUE INDEX "role_object_access_default_key"
  ON "role_object_access"("organizationId", "role") WHERE "objectTypeId" IS NULL;

-- A record is shared with a given user or team at most once.
CREATE UNIQUE INDEX "record_share_user_key"
  ON "record_share"("organizationId", "recordId", "userId") WHERE "userId" IS NOT NULL;
CREATE UNIQUE INDEX "record_share_team_key"
  ON "record_share"("organizationId", "recordId", "teamId") WHERE "teamId" IS NOT NULL;

-- Everything a row points at must belong to the row's organization. Plain foreign
-- keys cannot say that for these optional links, so triggers do.
CREATE FUNCTION role_object_access_same_organization() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."objectTypeId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "object_type"
    WHERE "id" = NEW."objectTypeId" AND "organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'object type % does not belong to organization %', NEW."objectTypeId", NEW."organizationId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER role_object_access_same_organization
  BEFORE INSERT OR UPDATE OF "objectTypeId", "organizationId" ON "role_object_access"
  FOR EACH ROW EXECUTE FUNCTION role_object_access_same_organization();

CREATE FUNCTION record_share_same_organization() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."teamId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "team" WHERE "id" = NEW."teamId" AND "organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'team % does not belong to organization %', NEW."teamId", NEW."organizationId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NEW."userId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "member" WHERE "userId" = NEW."userId" AND "organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'user % is not a member of organization %', NEW."userId", NEW."organizationId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER record_share_same_organization
  BEFORE INSERT OR UPDATE OF "teamId", "userId", "organizationId" ON "record_share"
  FOR EACH ROW EXECUTE FUNCTION record_share_same_organization();

-- Tenant isolation (see the tenancy_foundation migration)
CALL enable_tenant_rls('"role_object_access"');
CALL enable_tenant_rls('"record_share"');
