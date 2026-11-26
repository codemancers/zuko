-- CreateTable
CREATE TABLE "member_reporting" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "manager_id" BIGINT,

    CONSTRAINT "member_reporting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_hierarchy" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "ancestor_id" BIGINT NOT NULL,
    "descendant_id" BIGINT NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "member_hierarchy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_reporting_manager_id_idx" ON "member_reporting"("manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_reporting_organization_id_user_id_key" ON "member_reporting"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "member_hierarchy_organization_id_descendant_id_idx" ON "member_hierarchy"("organization_id", "descendant_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_hierarchy_organization_id_ancestor_id_descendant_id_key" ON "member_hierarchy"("organization_id", "ancestor_id", "descendant_id");

-- AddForeignKey
ALTER TABLE "member_reporting" ADD CONSTRAINT "member_reporting_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_reporting" ADD CONSTRAINT "member_reporting_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_reporting" ADD CONSTRAINT "member_reporting_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_hierarchy" ADD CONSTRAINT "member_hierarchy_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_hierarchy" ADD CONSTRAINT "member_hierarchy_ancestor_id_fkey" FOREIGN KEY ("ancestor_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_hierarchy" ADD CONSTRAINT "member_hierarchy_descendant_id_fkey" FOREIGN KEY ("descendant_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
