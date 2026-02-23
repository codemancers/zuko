-- CreateTable
CREATE TABLE "github_app" (
    "id" SERIAL NOT NULL,
    "installation_id" INTEGER NOT NULL,
    "account_login" TEXT NOT NULL,
    "suspended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_app_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "github_app_installation_id_key" ON "github_app"("installation_id");

-- RenameForeignKey
ALTER TABLE "account" RENAME CONSTRAINT "account_userId_fkey" TO "account_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "session" RENAME CONSTRAINT "session_userId_fkey" TO "session_user_id_fkey";

-- RenameIndex
ALTER INDEX "account_userId_idx" RENAME TO "account_user_id_idx";

-- RenameIndex
ALTER INDEX "session_userId_idx" RENAME TO "session_user_id_idx";
