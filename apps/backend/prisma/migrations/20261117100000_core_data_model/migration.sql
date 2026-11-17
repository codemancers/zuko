-- Core CRM data model: object types, field definitions, records and associations.
-- Generated from prisma/schema.prisma (new tables only), then extended by hand with
-- CHECK constraints and tenant row-level security.

-- CreateTable
CREATE TABLE "object_type" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "pluralLabel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "object_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_definition" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "objectTypeId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "filterable" BOOLEAN NOT NULL DEFAULT false,
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "maxLength" INTEGER,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "objectTypeId" BIGINT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "ownerId" BIGINT,
    "createdBy" BIGINT,
    "updatedBy" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "association_definition" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sourceObjectTypeId" BIGINT NOT NULL,
    "targetObjectTypeId" BIGINT NOT NULL,
    "cardinality" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isLookup" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "association_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "association" (
    "organizationId" BIGINT NOT NULL,
    "definitionId" BIGINT NOT NULL,
    "sourceId" BIGINT NOT NULL,
    "targetId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "association_pkey" PRIMARY KEY ("organizationId","definitionId","sourceId","targetId")
);

-- CreateIndex
CREATE UNIQUE INDEX "object_type_organizationId_slug_key" ON "object_type"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "object_type_organizationId_id_key" ON "object_type"("organizationId", "id");

-- CreateIndex
CREATE INDEX "field_definition_organizationId_objectTypeId_idx" ON "field_definition"("organizationId", "objectTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "field_definition_objectTypeId_name_key" ON "field_definition"("objectTypeId", "name");

-- CreateIndex
CREATE INDEX "record_organizationId_objectTypeId_createdAt_idx" ON "record"("organizationId", "objectTypeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "record_organizationId_objectTypeId_ownerId_idx" ON "record"("organizationId", "objectTypeId", "ownerId");

-- CreateIndex
CREATE INDEX "record_properties_idx" ON "record" USING GIN ("properties" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "record_organizationId_id_key" ON "record"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "association_definition_organizationId_name_key" ON "association_definition"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "association_definition_organizationId_id_key" ON "association_definition"("organizationId", "id");

-- CreateIndex
CREATE INDEX "association_organizationId_definitionId_targetId_sourceId_idx" ON "association"("organizationId", "definitionId", "targetId", "sourceId");

-- AddForeignKey
ALTER TABLE "object_type" ADD CONSTRAINT "object_type_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_definition" ADD CONSTRAINT "field_definition_organizationId_objectTypeId_fkey" FOREIGN KEY ("organizationId", "objectTypeId") REFERENCES "object_type"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record" ADD CONSTRAINT "record_organizationId_objectTypeId_fkey" FOREIGN KEY ("organizationId", "objectTypeId") REFERENCES "object_type"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record" ADD CONSTRAINT "record_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_definition" ADD CONSTRAINT "association_definition_organizationId_sourceObjectTypeId_fkey" FOREIGN KEY ("organizationId", "sourceObjectTypeId") REFERENCES "object_type"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_definition" ADD CONSTRAINT "association_definition_organizationId_targetObjectTypeId_fkey" FOREIGN KEY ("organizationId", "targetObjectTypeId") REFERENCES "object_type"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association" ADD CONSTRAINT "association_organizationId_definitionId_fkey" FOREIGN KEY ("organizationId", "definitionId") REFERENCES "association_definition"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association" ADD CONSTRAINT "association_organizationId_sourceId_fkey" FOREIGN KEY ("organizationId", "sourceId") REFERENCES "record"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association" ADD CONSTRAINT "association_organizationId_targetId_fkey" FOREIGN KEY ("organizationId", "targetId") REFERENCES "record"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraints Prisma cannot express
ALTER TABLE "object_type" ADD CONSTRAINT "object_type_kind_check"
  CHECK ("kind" IN ('STANDARD', 'CUSTOM'));
ALTER TABLE "field_definition" ADD CONSTRAINT "field_definition_name_check"
  CHECK ("name" ~ '^[a-z][a-z0-9_]*$');
ALTER TABLE "association_definition" ADD CONSTRAINT "association_definition_cardinality_check"
  CHECK ("cardinality" IN ('ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY'));

-- Listing live records is the hot path; soft-deleted rows are excluded.
CREATE INDEX "record_live_idx" ON "record"("organizationId", "objectTypeId", "createdAt" DESC)
  WHERE "deletedAt" IS NULL;

-- Tenant isolation (see the tenancy_foundation migration)
CALL enable_tenant_rls('"object_type"');
CALL enable_tenant_rls('"field_definition"');
CALL enable_tenant_rls('"record"');
CALL enable_tenant_rls('"association_definition"');
CALL enable_tenant_rls('"association"');
