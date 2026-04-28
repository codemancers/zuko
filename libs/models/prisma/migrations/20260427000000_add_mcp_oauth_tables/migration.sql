-- CreateTable: OAuth tables for BetterAuth mcp() plugin

CREATE TABLE "oauth_application" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "icon" TEXT,
    "metadata" TEXT,
    "client_id" TEXT,
    "client_secret" TEXT,
    "redirect_urls" TEXT,
    "type" TEXT,
    "disabled" BOOLEAN DEFAULT false,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "oauth_application_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_access_token" (
    "id" SERIAL NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "client_id" TEXT,
    "user_id" INTEGER,
    "scopes" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "oauth_access_token_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_consent" (
    "id" SERIAL NOT NULL,
    "client_id" TEXT,
    "user_id" INTEGER,
    "scopes" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "consent_given" BOOLEAN,

    CONSTRAINT "oauth_consent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_application_client_id_key" ON "oauth_application"("client_id");

CREATE INDEX "oauth_application_user_id_idx" ON "oauth_application"("user_id");

CREATE UNIQUE INDEX "oauth_access_token_access_token_key" ON "oauth_access_token"("access_token");

CREATE UNIQUE INDEX "oauth_access_token_refresh_token_key" ON "oauth_access_token"("refresh_token");

CREATE INDEX "oauth_access_token_client_id_idx" ON "oauth_access_token"("client_id");

CREATE INDEX "oauth_access_token_user_id_idx" ON "oauth_access_token"("user_id");

CREATE INDEX "oauth_consent_client_id_idx" ON "oauth_consent"("client_id");

CREATE INDEX "oauth_consent_user_id_idx" ON "oauth_consent"("user_id");

-- AddForeignKey
ALTER TABLE "oauth_application" ADD CONSTRAINT "oauth_application_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_application"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "oauth_consent" ADD CONSTRAINT "oauth_consent_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_application"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "oauth_consent" ADD CONSTRAINT "oauth_consent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
