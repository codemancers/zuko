-- CreateTable
CREATE TABLE "sales"."icp_profile" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "icp_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "icp_profile_organization_id_idx" ON "sales"."icp_profile"("organization_id");

-- AddForeignKey
ALTER TABLE "sales"."icp_profile" ADD CONSTRAINT "icp_profile_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
