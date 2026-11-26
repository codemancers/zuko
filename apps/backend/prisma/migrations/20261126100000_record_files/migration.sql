-- Which files are attached to which record, through which FILE field. A file may be attached to
-- many records. The field is named, not referenced: a field's key never changes once created.
CREATE TABLE "record_file" (
  "id" BIGSERIAL PRIMARY KEY,
  "organizationId" BIGINT NOT NULL,
  "recordId" BIGINT NOT NULL,
  "fieldName" TEXT NOT NULL,
  "fileId" BIGINT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdBy" BIGINT REFERENCES "user"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
  FOREIGN KEY ("organizationId", "recordId") REFERENCES "object_record"("organizationId", "id") ON DELETE CASCADE,
  FOREIGN KEY ("organizationId", "fileId") REFERENCES "stored_file"("organizationId", "id") ON DELETE CASCADE,
  UNIQUE ("recordId", "fieldName", "fileId")
);
CREATE INDEX "record_file_organizationId_fileId_idx" ON "record_file"("organizationId", "fileId");
CREATE INDEX "record_file_organizationId_recordId_idx" ON "record_file"("organizationId", "recordId", "fieldName", "position");
CALL enable_tenant_rls('"record_file"');
