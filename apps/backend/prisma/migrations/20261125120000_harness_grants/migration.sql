CREATE TABLE "harness_grant" (
  "id" BIGSERIAL PRIMARY KEY,
  "organization_id" BIGINT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id" BIGINT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "reference" TEXT NOT NULL UNIQUE,
  "source_type" TEXT NOT NULL CHECK ("source_type" IN ('session', 'consent')),
  "source_id" BIGINT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "scopes_key" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE ("organization_id", "source_type", "source_id", "scopes_key")
);
CALL enable_tenant_rls('"harness_grant"');
