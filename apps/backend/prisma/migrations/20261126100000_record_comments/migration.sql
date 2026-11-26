-- CreateTable
CREATE TABLE "record_comment" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "record_id" BIGINT NOT NULL,
    "object_type_id" BIGINT NOT NULL,
    "author_id" BIGINT,
    "actor_type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "record_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "record_comment_organization_id_record_id_created_at_id_idx" ON "record_comment"("organization_id", "record_id", "created_at", "id");

-- AddForeignKey
ALTER TABLE "record_comment" ADD CONSTRAINT "record_comment_organization_id_record_id_fkey" FOREIGN KEY ("organization_id", "record_id") REFERENCES "object_record"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_comment" ADD CONSTRAINT "record_comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Allowed values and sizes. A comment may be only a file, so the service (not the database) enforces
-- "text or a file"; the database keeps only the length bound.
ALTER TABLE "record_comment" ADD CONSTRAINT "record_comment_actor_type_check"
  CHECK ("actor_type" IN ('USER', 'MCP', 'AGENT'));
ALTER TABLE "record_comment" ADD CONSTRAINT "record_comment_body_check"
  CHECK (length("body") <= 10000);

-- The author and the comment's record must belong to the comment's organization.
CREATE FUNCTION record_comment_same_organization() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."author_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "member" WHERE "user_id" = NEW."author_id" AND "organization_id" = NEW."organization_id"
  ) THEN
    RAISE EXCEPTION 'user % is not a member of organization %', NEW."author_id", NEW."organization_id"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER record_comment_same_organization
  BEFORE INSERT OR UPDATE OF "author_id", "organization_id" ON "record_comment"
  FOR EACH ROW EXECUTE FUNCTION record_comment_same_organization();

-- Tenant isolation (see the tenancy_foundation migration)
CALL enable_tenant_rls('"record_comment"');
