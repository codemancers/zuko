-- CreateTable
CREATE TABLE "record_comment" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "recordId" BIGINT NOT NULL,
    "objectTypeId" BIGINT NOT NULL,
    "authorId" BIGINT,
    "actorType" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "record_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "record_comment_organizationId_recordId_createdAt_id_idx" ON "record_comment"("organizationId", "recordId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "record_comment" ADD CONSTRAINT "record_comment_organizationId_recordId_fkey" FOREIGN KEY ("organizationId", "recordId") REFERENCES "object_record"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_comment" ADD CONSTRAINT "record_comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Allowed values and sizes
ALTER TABLE "record_comment" ADD CONSTRAINT "record_comment_actorType_check"
  CHECK ("actorType" IN ('USER', 'MCP', 'AGENT'));
ALTER TABLE "record_comment" ADD CONSTRAINT "record_comment_body_check"
  CHECK (length(btrim("body")) > 0 AND length("body") <= 10000);

-- The author and the comment's record must belong to the comment's organization.
CREATE FUNCTION record_comment_same_organization() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."authorId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "member" WHERE "userId" = NEW."authorId" AND "organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'user % is not a member of organization %', NEW."authorId", NEW."organizationId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER record_comment_same_organization
  BEFORE INSERT OR UPDATE OF "authorId", "organizationId" ON "record_comment"
  FOR EACH ROW EXECUTE FUNCTION record_comment_same_organization();

-- Tenant isolation (see the tenancy_foundation migration)
CALL enable_tenant_rls('"record_comment"');
