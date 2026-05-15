-- AlterTable
ALTER TABLE "chat" ADD COLUMN     "agent_id" INTEGER;

-- AlterTable
ALTER TABLE "sandbox" ADD COLUMN     "agent_id" INTEGER;

-- CreateTable
CREATE TABLE "agent_hosts" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "user_id" INTEGER,
    "default_capabilities" TEXT,
    "public_key" TEXT,
    "kid" TEXT,
    "jwks_url" TEXT,
    "enrollment_token_hash" TEXT,
    "enrollment_token_expires_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "activated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_hosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_signing_keys" (
    "id" SERIAL NOT NULL,
    "agent_host_id" INTEGER NOT NULL,
    "private_jwk_encrypted" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMP(3),

    CONSTRAINT "host_signing_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_signing_keys" (
    "id" SERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "private_jwk_encrypted" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMP(3),

    CONSTRAINT "agent_signing_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" INTEGER,
    "host_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "mode" TEXT NOT NULL DEFAULT 'delegated',
    "public_key" TEXT NOT NULL,
    "kid" TEXT,
    "jwks_url" TEXT,
    "last_used_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_capability_grants" (
    "id" SERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "capability" TEXT NOT NULL,
    "denied_by" INTEGER,
    "granted_by" INTEGER,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reason" TEXT,
    "constraints" TEXT,

    CONSTRAINT "agent_capability_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" SERIAL NOT NULL,
    "method" TEXT NOT NULL,
    "agent_id" INTEGER,
    "host_id" INTEGER,
    "user_id" INTEGER,
    "capabilities" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "user_code_hash" TEXT,
    "login_hint" TEXT,
    "binding_message" TEXT,
    "client_notification_token" TEXT,
    "client_notification_endpoint" TEXT,
    "delivery_mode" TEXT,
    "interval" INTEGER NOT NULL,
    "last_polled_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_hosts_user_id_idx" ON "agent_hosts"("user_id");

-- CreateIndex
CREATE INDEX "agent_hosts_kid_idx" ON "agent_hosts"("kid");

-- CreateIndex
CREATE INDEX "agent_hosts_enrollment_token_hash_idx" ON "agent_hosts"("enrollment_token_hash");

-- CreateIndex
CREATE INDEX "agent_hosts_status_idx" ON "agent_hosts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "host_signing_keys_agent_host_id_key" ON "host_signing_keys"("agent_host_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_signing_keys_agent_id_key" ON "agent_signing_keys"("agent_id");

-- CreateIndex
CREATE INDEX "agents_user_id_idx" ON "agents"("user_id");

-- CreateIndex
CREATE INDEX "agents_host_id_idx" ON "agents"("host_id");

-- CreateIndex
CREATE INDEX "agents_status_idx" ON "agents"("status");

-- CreateIndex
CREATE INDEX "agents_kid_idx" ON "agents"("kid");

-- CreateIndex
CREATE INDEX "agent_capability_grants_agent_id_idx" ON "agent_capability_grants"("agent_id");

-- CreateIndex
CREATE INDEX "agent_capability_grants_capability_idx" ON "agent_capability_grants"("capability");

-- CreateIndex
CREATE INDEX "agent_capability_grants_granted_by_idx" ON "agent_capability_grants"("granted_by");

-- CreateIndex
CREATE INDEX "agent_capability_grants_status_idx" ON "agent_capability_grants"("status");

-- CreateIndex
CREATE INDEX "approval_requests_agent_id_idx" ON "approval_requests"("agent_id");

-- CreateIndex
CREATE INDEX "approval_requests_host_id_idx" ON "approval_requests"("host_id");

-- CreateIndex
CREATE INDEX "approval_requests_user_id_idx" ON "approval_requests"("user_id");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE INDEX "chat_agent_id_idx" ON "chat"("agent_id");

-- CreateIndex
CREATE INDEX "sandbox_agent_id_idx" ON "sandbox"("agent_id");

-- AddForeignKey
ALTER TABLE "agent_hosts" ADD CONSTRAINT "agent_hosts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_signing_keys" ADD CONSTRAINT "host_signing_keys_agent_host_id_fkey" FOREIGN KEY ("agent_host_id") REFERENCES "agent_hosts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_signing_keys" ADD CONSTRAINT "agent_signing_keys_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "agent_hosts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_capability_grants" ADD CONSTRAINT "agent_capability_grants_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_capability_grants" ADD CONSTRAINT "agent_capability_grants_denied_by_fkey" FOREIGN KEY ("denied_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_capability_grants" ADD CONSTRAINT "agent_capability_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "agent_hosts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat" ADD CONSTRAINT "chat_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sandbox" ADD CONSTRAINT "sandbox_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
