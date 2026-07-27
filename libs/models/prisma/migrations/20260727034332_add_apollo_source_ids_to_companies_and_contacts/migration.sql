-- AlterTable
ALTER TABLE "sales"."company" ADD COLUMN     "apollo_account_id" TEXT,
ADD COLUMN     "apollo_organization_id" TEXT;

-- AlterTable
ALTER TABLE "sales"."contact" ADD COLUMN     "apollo_contact_id" TEXT,
ADD COLUMN     "apollo_person_id" TEXT;

-- CreateIndex
CREATE INDEX "company_apollo_organization_id_idx" ON "sales"."company"("apollo_organization_id");

-- CreateIndex
CREATE INDEX "company_apollo_account_id_idx" ON "sales"."company"("apollo_account_id");

-- CreateIndex
CREATE INDEX "contact_apollo_person_id_idx" ON "sales"."contact"("apollo_person_id");

-- CreateIndex
CREATE INDEX "contact_apollo_contact_id_idx" ON "sales"."contact"("apollo_contact_id");
