CREATE TABLE "stored_file" (
  "id" BIGSERIAL PRIMARY KEY,
  "organizationId" BIGINT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "uploadedBy" BIGINT REFERENCES "user"("id") ON DELETE SET NULL,
  "filename" TEXT NOT NULL,
  "mediaType" TEXT NOT NULL,
  "size" INTEGER NOT NULL CHECK ("size" > 0 AND "size" <= 26214400),
  "sha256" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
  "deletedAt" TIMESTAMP(3),
  UNIQUE ("organizationId", "id")
);
CREATE INDEX "stored_file_organizationId_uploadedBy_idx" ON "stored_file"("organizationId", "uploadedBy");
CALL enable_tenant_rls('"stored_file"');
