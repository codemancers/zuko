-- CreateTable
CREATE TABLE "sales"."campaign" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'apollo',
    "provider_sequence_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT NOT NULL DEFAULT 'team_can_use',
    "sequence" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_organization_id_idx" ON "sales"."campaign"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_organization_id_provider_sequence_id_key" ON "sales"."campaign"("organization_id", "provider_sequence_id");

-- AddForeignKey
ALTER TABLE "sales"."campaign" ADD CONSTRAINT "campaign_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."campaign" ADD CONSTRAINT "campaign_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
