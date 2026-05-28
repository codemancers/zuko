-- CreateTable
CREATE TABLE "connection" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "connected_by_id" INTEGER NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connection_organization_id_idx" ON "connection"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "connection_organization_id_provider_key" ON "connection"("organization_id", "provider");

-- AddForeignKey
ALTER TABLE "connection" ADD CONSTRAINT "connection_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection" ADD CONSTRAINT "connection_connected_by_id_fkey" FOREIGN KEY ("connected_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
