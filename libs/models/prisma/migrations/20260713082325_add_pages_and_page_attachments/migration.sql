-- CreateTable
CREATE TABLE "page" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '{}',
    "version" TEXT NOT NULL DEFAULT '2.29.0',
    "created_by" INTEGER NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_organization_id_idx" ON "page"("organization_id");

-- CreateIndex
CREATE INDEX "page_parent_id_idx" ON "page"("parent_id");

-- AddForeignKey
ALTER TABLE "page" ADD CONSTRAINT "page_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page" ADD CONSTRAINT "page_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page" ADD CONSTRAINT "page_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
