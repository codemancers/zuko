-- The raw response a data provider (Apollo) returned for a record, kept so it can be re-mapped
-- without paying for the lookup again. Values worth showing are copied into the record's
-- properties by the service; this table is the source they were copied from.
CREATE TABLE "record_enrichment" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "record_id" BIGINT NOT NULL,
    "provider" TEXT NOT NULL,
    -- What was looked up: the person or the organization behind the record.
    "subject" TEXT NOT NULL,
    -- The provider's own id for the match.
    "external_id" TEXT,
    "payload" JSONB NOT NULL,
    "requested_by" BIGINT,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "record_enrichment_pkey" PRIMARY KEY ("id")
);

-- A new lookup replaces the old one.
CREATE UNIQUE INDEX "record_enrichment_record_id_provider_subject_key" ON "record_enrichment"("record_id", "provider", "subject");
CREATE UNIQUE INDEX "record_enrichment_organization_id_id_key" ON "record_enrichment"("organization_id", "id");

ALTER TABLE "record_enrichment" ADD CONSTRAINT "record_enrichment_organization_id_record_id_fkey" FOREIGN KEY ("organization_id", "record_id") REFERENCES "object_record"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "record_enrichment" ADD CONSTRAINT "record_enrichment_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "record_enrichment" ADD CONSTRAINT "record_enrichment_subject_check"
  CHECK ("subject" IN ('PERSON', 'ORGANIZATION'));

-- Tenant isolation (see the tenancy_foundation migration)
CALL enable_tenant_rls('"record_enrichment"');
