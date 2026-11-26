-- Files attached to a comment. A file may be attached to many comments and records; deleting a
-- comment (soft) or its record stops the file being readable through it.
--
-- A comment may be only a file. "Text or a file" spans two tables, so the service enforces it and the
-- database keeps only the length bound.
ALTER TABLE "record_comment" DROP CONSTRAINT "record_comment_body_check";
ALTER TABLE "record_comment" ADD CONSTRAINT "record_comment_body_check" CHECK (length("body") <= 10000);

CREATE UNIQUE INDEX "record_comment_organizationId_id_key" ON "record_comment"("organizationId", "id");

CREATE TABLE "comment_file" (
  "id" BIGSERIAL PRIMARY KEY,
  "organizationId" BIGINT NOT NULL,
  "commentId" BIGINT NOT NULL,
  "fileId" BIGINT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
  FOREIGN KEY ("organizationId", "commentId") REFERENCES "record_comment"("organizationId", "id") ON DELETE CASCADE,
  FOREIGN KEY ("organizationId", "fileId") REFERENCES "stored_file"("organizationId", "id") ON DELETE CASCADE,
  UNIQUE ("commentId", "fileId")
);
CREATE INDEX "comment_file_organizationId_fileId_idx" ON "comment_file"("organizationId", "fileId");
CALL enable_tenant_rls('"comment_file"');
