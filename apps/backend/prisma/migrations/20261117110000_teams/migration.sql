-- AlterTable
ALTER TABLE "invitation" ADD COLUMN     "team_id" TEXT;

-- AlterTable
ALTER TABLE "object_record" ADD COLUMN     "team_id" BIGINT;

-- AlterTable
ALTER TABLE "session" ADD COLUMN     "active_team_id" BIGINT;

-- CreateTable
CREATE TABLE "team" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "organization_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "id" BIGSERIAL NOT NULL,
    "team_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "membership_key" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_organization_id_idx" ON "team"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_membership_key_key" ON "team_member"("membership_key");

-- CreateIndex
CREATE INDEX "team_member_team_id_idx" ON "team_member"("team_id");

-- CreateIndex
CREATE INDEX "team_member_user_id_idx" ON "team_member"("user_id");

-- CreateIndex
CREATE INDEX "object_record_organization_id_team_id_idx" ON "object_record"("organization_id", "team_id");

-- AddForeignKey
ALTER TABLE "object_record" ADD CONSTRAINT "object_record_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A record may only belong to a team of its own organization. A composite foreign
-- key cannot express this while still allowing ON DELETE SET NULL on the team.
CREATE FUNCTION object_record_team_same_organization() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."team_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "team" WHERE "id" = NEW."team_id" AND "organization_id" = NEW."organization_id"
  ) THEN
    RAISE EXCEPTION 'team % does not belong to organization %', NEW."team_id", NEW."organization_id"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER object_record_team_same_organization
  BEFORE INSERT OR UPDATE OF "team_id", "organization_id" ON "object_record"
  FOR EACH ROW EXECUTE FUNCTION object_record_team_same_organization();
