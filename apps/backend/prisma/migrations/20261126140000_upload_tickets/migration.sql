-- A short-lived, single-use link to upload one file, bound to the user who asked for it. It lets a
-- client that cannot carry the user's token (an MCP client running curl) upload out of band; only a
-- hash of the secret is stored.
CREATE TABLE "upload_ticket" (
  "id" BIGSERIAL PRIMARY KEY,
  "organizationId" BIGINT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "userId" BIGINT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "secretHash" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX "upload_ticket_organizationId_expiresAt_idx" ON "upload_ticket"("organizationId", "expiresAt");
CALL enable_tenant_rls('"upload_ticket"');
