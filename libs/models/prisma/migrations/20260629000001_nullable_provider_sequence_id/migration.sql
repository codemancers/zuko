-- AlterTable: make provider_sequence_id nullable
ALTER TABLE "sales"."campaign" ALTER COLUMN "provider_sequence_id" DROP NOT NULL;
