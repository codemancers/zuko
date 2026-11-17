-- CreateTable
CREATE TABLE "member_reporting" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "managerId" BIGINT,

    CONSTRAINT "member_reporting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_hierarchy" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "ancestorId" BIGINT NOT NULL,
    "descendantId" BIGINT NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "member_hierarchy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_reporting_managerId_idx" ON "member_reporting"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "member_reporting_organizationId_userId_key" ON "member_reporting"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "member_hierarchy_organizationId_descendantId_idx" ON "member_hierarchy"("organizationId", "descendantId");

-- CreateIndex
CREATE UNIQUE INDEX "member_hierarchy_organizationId_ancestorId_descendantId_key" ON "member_hierarchy"("organizationId", "ancestorId", "descendantId");

-- AddForeignKey
ALTER TABLE "member_reporting" ADD CONSTRAINT "member_reporting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_reporting" ADD CONSTRAINT "member_reporting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_reporting" ADD CONSTRAINT "member_reporting_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_hierarchy" ADD CONSTRAINT "member_hierarchy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_hierarchy" ADD CONSTRAINT "member_hierarchy_ancestorId_fkey" FOREIGN KEY ("ancestorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_hierarchy" ADD CONSTRAINT "member_hierarchy_descendantId_fkey" FOREIGN KEY ("descendantId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
