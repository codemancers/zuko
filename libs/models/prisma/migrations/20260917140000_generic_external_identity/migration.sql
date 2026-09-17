-- Replace vendor-specific identity columns with a generic pair across the
-- sales schema: externalType names the system, externalId is who they are in
-- it. Prospects can be sourced from Apollo, Origami, Salesforce or anywhere
-- else, and the schema should not have to change to add the next one.
--
-- Existing Apollo values are carried over, not dropped.

-- ---------- contact ----------
ALTER TABLE "sales"."contact"
  ADD COLUMN "external_type" TEXT,
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "external_record_id" TEXT;

UPDATE "sales"."contact"
SET "external_type" = 'apollo',
    "external_id" = "apollo_person_id",
    "external_record_id" = "apollo_contact_id"
WHERE "apollo_person_id" IS NOT NULL OR "apollo_contact_id" IS NOT NULL;

DROP INDEX IF EXISTS "sales"."contact_apollo_person_id_idx";
DROP INDEX IF EXISTS "sales"."contact_apollo_contact_id_idx";
ALTER TABLE "sales"."contact"
  DROP COLUMN "apollo_person_id",
  DROP COLUMN "apollo_contact_id";

CREATE INDEX "contact_external_type_external_id_idx"
  ON "sales"."contact" ("external_type", "external_id");
CREATE INDEX "contact_external_record_id_idx"
  ON "sales"."contact" ("external_record_id");

-- ---------- company ----------
ALTER TABLE "sales"."company"
  ADD COLUMN "external_type" TEXT,
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "external_record_id" TEXT;

UPDATE "sales"."company"
SET "external_type" = 'apollo',
    "external_id" = "apollo_organization_id",
    "external_record_id" = "apollo_account_id"
WHERE "apollo_organization_id" IS NOT NULL OR "apollo_account_id" IS NOT NULL;

DROP INDEX IF EXISTS "sales"."company_apollo_organization_id_idx";
DROP INDEX IF EXISTS "sales"."company_apollo_account_id_idx";
ALTER TABLE "sales"."company"
  DROP COLUMN "apollo_organization_id",
  DROP COLUMN "apollo_account_id";

CREATE INDEX "company_external_type_external_id_idx"
  ON "sales"."company" ("external_type", "external_id");
CREATE INDEX "company_external_record_id_idx"
  ON "sales"."company" ("external_record_id");

-- ---------- lead ----------
ALTER TABLE "sales"."lead"
  ADD COLUMN "external_type" TEXT,
  ADD COLUMN "external_id" TEXT;

UPDATE "sales"."lead"
SET "external_type" = 'apollo',
    "external_id" = "apollo_person_id"
WHERE "apollo_person_id" IS NOT NULL;

ALTER TABLE "sales"."lead" DROP COLUMN "apollo_person_id";

CREATE INDEX "lead_external_type_external_id_idx"
  ON "sales"."lead" ("external_type", "external_id");

-- ---------- prospect ----------
ALTER TABLE "sales"."prospect"
  ADD COLUMN "external_type" TEXT,
  ADD COLUMN "external_id" TEXT;

UPDATE "sales"."prospect"
SET "external_type" = 'apollo',
    "external_id" = "apollo_person_id"
WHERE "apollo_person_id" IS NOT NULL;

DROP INDEX IF EXISTS "sales"."prospect_organization_id_apollo_person_id_key";
ALTER TABLE "sales"."prospect" DROP COLUMN "apollo_person_id";

CREATE UNIQUE INDEX "prospect_organization_id_external_type_external_id_key"
  ON "sales"."prospect" ("organization_id", "external_type", "external_id");

-- ---------- campaign ----------
-- `platform` duplicated `provider` and was referenced nowhere; it goes.
ALTER TABLE "sales"."campaign"
  ADD COLUMN "external_type" TEXT NOT NULL DEFAULT 'apollo',
  ADD COLUMN "external_id" TEXT;

UPDATE "sales"."campaign"
SET "external_type" = COALESCE("provider", 'apollo'),
    "external_id" = "provider_sequence_id";

DROP INDEX IF EXISTS "sales"."campaign_organization_id_provider_sequence_id_key";
ALTER TABLE "sales"."campaign"
  DROP COLUMN "provider",
  DROP COLUMN "platform",
  DROP COLUMN "provider_sequence_id";

CREATE UNIQUE INDEX "campaign_organization_id_external_type_external_id_key"
  ON "sales"."campaign" ("organization_id", "external_type", "external_id");
