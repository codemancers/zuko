-- Files attached to a comment. A file may be attached to many comments and records; deleting a
-- comment (soft) or its record stops the file being readable through it.

CREATE UNIQUE INDEX "record_comment_organization_id_id_key" ON "record_comment"("organization_id", "id");

CREATE TABLE "comment_file" (
  "id" BIGSERIAL PRIMARY KEY,
  "organization_id" BIGINT NOT NULL,
  "comment_id" BIGINT NOT NULL,
  "file_id" BIGINT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
  FOREIGN KEY ("organization_id", "comment_id") REFERENCES "record_comment"("organization_id", "id") ON DELETE CASCADE,
  FOREIGN KEY ("organization_id", "file_id") REFERENCES "stored_file"("organization_id", "id") ON DELETE CASCADE,
  UNIQUE ("comment_id", "file_id")
);
CREATE INDEX "comment_file_organization_id_file_id_idx" ON "comment_file"("organization_id", "file_id");
CALL enable_tenant_rls('"comment_file"');
