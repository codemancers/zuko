-- CreateEnum
CREATE TYPE "SandboxLifecycleState" AS ENUM ('provisioning', 'active', 'hibernating', 'hibernated', 'restoring', 'failed');

-- AlterTable
ALTER TABLE "sandbox" ADD COLUMN     "hibernate_after" TIMESTAMP(3),
ADD COLUMN     "last_activity_at" TIMESTAMP(3),
ADD COLUMN     "lifecycle_error" TEXT,
ADD COLUMN     "lifecycle_state" "SandboxLifecycleState" NOT NULL DEFAULT 'provisioning';

-- CreateIndex
CREATE INDEX "sandbox_lifecycle_state_idx" ON "sandbox"("lifecycle_state");

-- CreateIndex
CREATE INDEX "sandbox_hibernate_after_idx" ON "sandbox"("hibernate_after");
