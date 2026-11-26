-- Core CRM data model: object types, field definitions, records and associations.
-- Generated from prisma/schema.prisma (new tables only), then extended by hand with
-- CHECK constraints and tenant row-level security.

-- CreateTable
CREATE TABLE "object_type" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "plural_label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "object_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_definition" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "object_type_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "is_unique" BOOLEAN NOT NULL DEFAULT false,
    "filterable" BOOLEAN NOT NULL DEFAULT false,
    "read_only" BOOLEAN NOT NULL DEFAULT false,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "max_length" INTEGER,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "field_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_record" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "object_type_id" BIGINT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "owner_id" BIGINT,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "object_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "association_definition" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source_object_type_id" BIGINT NOT NULL,
    "target_object_type_id" BIGINT NOT NULL,
    "many" BOOLEAN NOT NULL DEFAULT true,
    "reverse_label" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_lookup" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "association_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "association" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "definition_id" BIGINT NOT NULL,
    "source_id" BIGINT NOT NULL,
    "target_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "association_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "association_organization_id_definition_id_source_id_target__key" ON "association"("organization_id", "definition_id", "source_id", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "object_type_organization_id_slug_key" ON "object_type"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "object_type_organization_id_id_key" ON "object_type"("organization_id", "id");

-- CreateIndex
CREATE INDEX "field_definition_organization_id_object_type_id_idx" ON "field_definition"("organization_id", "object_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_definition_object_type_id_name_key" ON "field_definition"("object_type_id", "name");

-- CreateIndex
CREATE INDEX "object_record_organization_id_object_type_id_created_at_idx" ON "object_record"("organization_id", "object_type_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "object_record_organization_id_object_type_id_owner_id_idx" ON "object_record"("organization_id", "object_type_id", "owner_id");

-- CreateIndex
CREATE INDEX "object_record_properties_idx" ON "object_record" USING GIN ("properties" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "object_record_organization_id_id_key" ON "object_record"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "association_definition_organization_id_name_key" ON "association_definition"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "association_definition_organization_id_id_key" ON "association_definition"("organization_id", "id");

-- CreateIndex
CREATE INDEX "association_organization_id_definition_id_target_id_source__idx" ON "association"("organization_id", "definition_id", "target_id", "source_id");

-- AddForeignKey
ALTER TABLE "object_type" ADD CONSTRAINT "object_type_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_definition" ADD CONSTRAINT "field_definition_organization_id_object_type_id_fkey" FOREIGN KEY ("organization_id", "object_type_id") REFERENCES "object_type"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_record" ADD CONSTRAINT "object_record_organization_id_object_type_id_fkey" FOREIGN KEY ("organization_id", "object_type_id") REFERENCES "object_type"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_record" ADD CONSTRAINT "object_record_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_definition" ADD CONSTRAINT "association_definition_organization_id_source_object_type__fkey" FOREIGN KEY ("organization_id", "source_object_type_id") REFERENCES "object_type"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_definition" ADD CONSTRAINT "association_definition_organization_id_target_object_type__fkey" FOREIGN KEY ("organization_id", "target_object_type_id") REFERENCES "object_type"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association" ADD CONSTRAINT "association_organization_id_definition_id_fkey" FOREIGN KEY ("organization_id", "definition_id") REFERENCES "association_definition"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association" ADD CONSTRAINT "association_organization_id_source_id_fkey" FOREIGN KEY ("organization_id", "source_id") REFERENCES "object_record"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association" ADD CONSTRAINT "association_organization_id_target_id_fkey" FOREIGN KEY ("organization_id", "target_id") REFERENCES "object_record"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraints Prisma cannot express
ALTER TABLE "object_type" ADD CONSTRAINT "object_type_kind_check"
  CHECK ("kind" IN ('STANDARD', 'CUSTOM'));
ALTER TABLE "field_definition" ADD CONSTRAINT "field_definition_name_check"
  CHECK ("name" ~ '^[a-z][a-z0-9_]*$');

-- Listing live records is the hot path; soft-deleted rows are excluded.
CREATE INDEX "object_record_live_idx" ON "object_record"("organization_id", "object_type_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL;

-- Tenant isolation (see the tenancy_foundation migration)
CALL enable_tenant_rls('"object_type"');
CALL enable_tenant_rls('"field_definition"');
CALL enable_tenant_rls('"object_record"');
CALL enable_tenant_rls('"association_definition"');
CALL enable_tenant_rls('"association"');
