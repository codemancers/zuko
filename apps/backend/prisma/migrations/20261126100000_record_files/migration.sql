-- Which files are attached to which record, through which FILE field. A file may be attached to
-- many records. The field is named, not referenced: a field's key never changes once created.
CREATE TABLE "record_file" (
  "id" BIGSERIAL PRIMARY KEY,
  "organization_id" BIGINT NOT NULL,
  "record_id" BIGINT NOT NULL,
  "field_name" TEXT NOT NULL,
  "file_id" BIGINT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_by" BIGINT REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
  FOREIGN KEY ("organization_id", "record_id") REFERENCES "object_record"("organization_id", "id") ON DELETE CASCADE,
  FOREIGN KEY ("organization_id", "file_id") REFERENCES "stored_file"("organization_id", "id") ON DELETE CASCADE,
  UNIQUE ("record_id", "field_name", "file_id")
);
CREATE INDEX "record_file_organization_id_file_id_idx" ON "record_file"("organization_id", "file_id");
CREATE INDEX "record_file_organization_id_record_id_idx" ON "record_file"("organization_id", "record_id", "field_name", "position");
CALL enable_tenant_rls('"record_file"');
