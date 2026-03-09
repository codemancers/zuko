-- AlterTable: Add organization_id to contact (sales schema)
ALTER TABLE "sales"."contact" ADD COLUMN "organization_id" INTEGER NOT NULL;

-- AlterTable: Add organization_id to company (sales schema)
ALTER TABLE "sales"."company" ADD COLUMN "organization_id" INTEGER NOT NULL;

-- AlterTable: Add organization_id to deal (sales schema)
ALTER TABLE "sales"."deal" ADD COLUMN "organization_id" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "contact_organization_id_idx" ON "sales"."contact"("organization_id");

-- CreateIndex
CREATE INDEX "company_organization_id_idx" ON "sales"."company"("organization_id");

-- CreateIndex
CREATE INDEX "deal_organization_id_idx" ON "sales"."deal"("organization_id");

-- AddForeignKey: contact -> organization (public)
ALTER TABLE "sales"."contact" ADD CONSTRAINT "contact_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: company -> organization (public)
ALTER TABLE "sales"."company" ADD CONSTRAINT "company_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: deal -> organization (public)
ALTER TABLE "sales"."deal" ADD CONSTRAINT "deal_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
