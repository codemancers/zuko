-- A short-lived, single-use link to upload one file, bound to the user who asked for it. It lets a
-- client that cannot carry the user's token (an MCP client running curl) upload out of band; only a
-- hash of the secret is stored.
CREATE TABLE "upload_ticket" (
  "id" BIGSERIAL PRIMARY KEY,
  "organization_id" BIGINT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id" BIGINT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "secret_hash" TEXT NOT NULL,
  "actor_type" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX "upload_ticket_organization_id_expires_at_idx" ON "upload_ticket"("organization_id", "expires_at");
CALL enable_tenant_rls('"upload_ticket"');
