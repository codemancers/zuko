-- DropForeignKey
ALTER TABLE "sales"."lead" DROP CONSTRAINT "lead_icp_profile_id_fkey";

-- AlterTable
ALTER TABLE "sales"."lead" ALTER COLUMN "icp_profile_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "sales"."lead" ADD CONSTRAINT "lead_icp_profile_id_fkey" FOREIGN KEY ("icp_profile_id") REFERENCES "sales"."icp_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
