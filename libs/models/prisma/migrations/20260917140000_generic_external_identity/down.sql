-- Rollback for 20260917140000_generic_external_identity.
-- Restores the Apollo-specific columns and copies values back for rows whose
-- external_type is 'apollo'. Identities from any other system are lost, since
-- the old schema had nowhere to put them.
ALTER TABLE "sales"."contact" ADD COLUMN "apollo_person_id" TEXT, ADD COLUMN "apollo_contact_id" TEXT;
UPDATE "sales"."contact" SET "apollo_person_id" = "external_id", "apollo_contact_id" = "external_record_id" WHERE "external_type" = 'apollo';
DROP INDEX IF EXISTS "sales"."contact_external_type_external_id_idx";
DROP INDEX IF EXISTS "sales"."contact_external_record_id_idx";
ALTER TABLE "sales"."contact" DROP COLUMN "external_type", DROP COLUMN "external_id", DROP COLUMN "external_record_id";
CREATE INDEX "contact_apollo_person_id_idx" ON "sales"."contact" ("apollo_person_id");
CREATE INDEX "contact_apollo_contact_id_idx" ON "sales"."contact" ("apollo_contact_id");

ALTER TABLE "sales"."company" ADD COLUMN "apollo_organization_id" TEXT, ADD COLUMN "apollo_account_id" TEXT;
UPDATE "sales"."company" SET "apollo_organization_id" = "external_id", "apollo_account_id" = "external_record_id" WHERE "external_type" = 'apollo';
DROP INDEX IF EXISTS "sales"."company_external_type_external_id_idx";
DROP INDEX IF EXISTS "sales"."company_external_record_id_idx";
ALTER TABLE "sales"."company" DROP COLUMN "external_type", DROP COLUMN "external_id", DROP COLUMN "external_record_id";
CREATE INDEX "company_apollo_organization_id_idx" ON "sales"."company" ("apollo_organization_id");
CREATE INDEX "company_apollo_account_id_idx" ON "sales"."company" ("apollo_account_id");

ALTER TABLE "sales"."lead" ADD COLUMN "apollo_person_id" TEXT;
UPDATE "sales"."lead" SET "apollo_person_id" = "external_id" WHERE "external_type" = 'apollo';
DROP INDEX IF EXISTS "sales"."lead_external_type_external_id_idx";
ALTER TABLE "sales"."lead" DROP COLUMN "external_type", DROP COLUMN "external_id";

ALTER TABLE "sales"."prospect" ADD COLUMN "apollo_person_id" TEXT;
UPDATE "sales"."prospect" SET "apollo_person_id" = "external_id" WHERE "external_type" = 'apollo';
DROP INDEX IF EXISTS "sales"."prospect_organization_id_external_type_external_id_key";
ALTER TABLE "sales"."prospect" DROP COLUMN "external_type", DROP COLUMN "external_id";
CREATE UNIQUE INDEX "prospect_organization_id_apollo_person_id_key" ON "sales"."prospect" ("organization_id", "apollo_person_id");

ALTER TABLE "sales"."campaign" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'apollo', ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'apollo', ADD COLUMN "provider_sequence_id" TEXT;
UPDATE "sales"."campaign" SET "provider" = "external_type", "provider_sequence_id" = "external_id";
DROP INDEX IF EXISTS "sales"."campaign_organization_id_external_type_external_id_key";
ALTER TABLE "sales"."campaign" DROP COLUMN "external_type", DROP COLUMN "external_id";
CREATE UNIQUE INDEX "campaign_organization_id_provider_sequence_id_key" ON "sales"."campaign" ("organization_id", "provider_sequence_id");
