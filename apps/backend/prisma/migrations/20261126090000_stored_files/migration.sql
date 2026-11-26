CREATE TABLE "stored_file" (
  "id" BIGSERIAL PRIMARY KEY,
  "organization_id" BIGINT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "uploaded_by" BIGINT REFERENCES "user"("id") ON DELETE SET NULL,
  "filename" TEXT NOT NULL,
  "media_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL CHECK ("size" > 0 AND "size" <= 26214400),
  "sha256" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL UNIQUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
  "deleted_at" TIMESTAMP(3),
  UNIQUE ("organization_id", "id")
);
CREATE INDEX "stored_file_organization_id_uploaded_by_idx" ON "stored_file"("organization_id", "uploaded_by");
CALL enable_tenant_rls('"stored_file"');
