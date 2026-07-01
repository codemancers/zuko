-- AlterTable
ALTER TABLE "sales"."campaign" ADD COLUMN "icp_profile_id" INTEGER;
ALTER TABLE "sales"."campaign" ALTER COLUMN "provider_sequence_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "campaign_icp_profile_id_idx" ON "sales"."campaign"("icp_profile_id");

-- AddForeignKey
ALTER TABLE "sales"."campaign" ADD CONSTRAINT "campaign_icp_profile_id_fkey" FOREIGN KEY ("icp_profile_id") REFERENCES "sales"."icp_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
