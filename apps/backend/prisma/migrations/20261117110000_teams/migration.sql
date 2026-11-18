-- AlterTable
ALTER TABLE "invitation" ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "object_record" ADD COLUMN     "teamId" BIGINT;

-- AlterTable
ALTER TABLE "session" ADD COLUMN     "activeTeamId" BIGINT;

-- CreateTable
CREATE TABLE "team" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "organizationId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "id" BIGSERIAL NOT NULL,
    "teamId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "membershipKey" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_organizationId_idx" ON "team"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_membershipKey_key" ON "team_member"("membershipKey");

-- CreateIndex
CREATE INDEX "team_member_teamId_idx" ON "team_member"("teamId");

-- CreateIndex
CREATE INDEX "team_member_userId_idx" ON "team_member"("userId");

-- CreateIndex
CREATE INDEX "object_record_organizationId_teamId_idx" ON "object_record"("organizationId", "teamId");

-- AddForeignKey
ALTER TABLE "object_record" ADD CONSTRAINT "object_record_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A record may only belong to a team of its own organization. A composite foreign
-- key cannot express this while still allowing ON DELETE SET NULL on the team.
CREATE FUNCTION object_record_team_same_organization() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."teamId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "team" WHERE "id" = NEW."teamId" AND "organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'team % does not belong to organization %', NEW."teamId", NEW."organizationId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER object_record_team_same_organization
  BEFORE INSERT OR UPDATE OF "teamId", "organizationId" ON "object_record"
  FOR EACH ROW EXECUTE FUNCTION object_record_team_same_organization();
