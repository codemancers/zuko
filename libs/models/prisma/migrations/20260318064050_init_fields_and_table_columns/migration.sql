-- AlterTable
ALTER TABLE "sales"."company" ADD COLUMN     "fields" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "sales"."contact" ADD COLUMN     "fields" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "sales"."deal" ADD COLUMN     "fields" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "sales"."table_column" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "table_name" TEXT NOT NULL,
    "column_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "table_column_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "table_column_organization_id_idx" ON "sales"."table_column"("organization_id");

-- CreateIndex
CREATE INDEX "table_column_table_name_idx" ON "sales"."table_column"("table_name");

-- CreateIndex
CREATE INDEX "table_column_organization_id_table_name_idx" ON "sales"."table_column"("organization_id", "table_name");

-- CreateIndex
CREATE UNIQUE INDEX "table_column_organization_id_table_name_column_key_key" ON "sales"."table_column"("organization_id", "table_name", "column_key");

-- AddForeignKey
ALTER TABLE "sales"."table_column" ADD CONSTRAINT "table_column_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."table_column" ADD CONSTRAINT "table_column_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
