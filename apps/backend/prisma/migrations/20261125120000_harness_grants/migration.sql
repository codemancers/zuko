CREATE TABLE "harness_grant" (
  "id" BIGSERIAL PRIMARY KEY,
  "organizationId" BIGINT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "userId" BIGINT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "reference" TEXT NOT NULL UNIQUE,
  "sourceType" TEXT NOT NULL CHECK ("sourceType" IN ('session', 'consent')),
  "sourceId" BIGINT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "scopesKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE ("organizationId", "sourceType", "sourceId", "scopesKey")
);
CALL enable_tenant_rls('"harness_grant"');
