-- AlterTable
ALTER TABLE "sales"."campaign" ADD COLUMN     "platform" TEXT NOT NULL DEFAULT 'apollo';

-- CreateTable
CREATE TABLE "sales"."lead" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "icp_profile_id" INTEGER NOT NULL,
    "campaign_id" INTEGER,
    "contact_id" INTEGER,
    "deal_id" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company_name" TEXT,
    "title" TEXT,
    "linkedin_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'replied',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "apollo_person_id" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_organization_id_idx" ON "sales"."lead"("organization_id");

-- CreateIndex
CREATE INDEX "lead_icp_profile_id_idx" ON "sales"."lead"("icp_profile_id");

-- CreateIndex
CREATE INDEX "lead_campaign_id_idx" ON "sales"."lead"("campaign_id");

-- CreateIndex
CREATE INDEX "lead_status_idx" ON "sales"."lead"("status");

-- AddForeignKey
ALTER TABLE "sales"."lead" ADD CONSTRAINT "lead_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."lead" ADD CONSTRAINT "lead_icp_profile_id_fkey" FOREIGN KEY ("icp_profile_id") REFERENCES "sales"."icp_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."lead" ADD CONSTRAINT "lead_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "sales"."campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."lead" ADD CONSTRAINT "lead_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sales"."contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."lead" ADD CONSTRAINT "lead_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "sales"."deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
