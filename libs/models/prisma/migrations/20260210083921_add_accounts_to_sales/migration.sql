-- CreateTable
CREATE TABLE "sales"."company" (
    "id" SERIAL NOT NULL,
    "company_name" TEXT NOT NULL,
    "website" TEXT,
    "linkedin_url" TEXT,
    "summary" TEXT,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."company_contact" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "role" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."company_owner" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_owner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_is_hidden_idx" ON "sales"."company"("is_hidden");

-- CreateIndex
CREATE INDEX "company_company_name_idx" ON "sales"."company"("company_name");

-- CreateIndex
CREATE INDEX "company_contact_company_id_idx" ON "sales"."company_contact"("company_id");

-- CreateIndex
CREATE INDEX "company_contact_contact_id_idx" ON "sales"."company_contact"("contact_id");

-- CreateIndex
CREATE INDEX "company_contact_left_at_idx" ON "sales"."company_contact"("left_at");

-- CreateIndex
CREATE INDEX "company_owner_user_id_idx" ON "sales"."company_owner"("user_id");

-- CreateIndex
CREATE INDEX "company_owner_company_id_idx" ON "sales"."company_owner"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_owner_company_id_user_id_key" ON "sales"."company_owner"("company_id", "user_id");

-- AddForeignKey
ALTER TABLE "sales"."company_contact" ADD CONSTRAINT "company_contact_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "sales"."company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."company_contact" ADD CONSTRAINT "company_contact_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sales"."contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."company_owner" ADD CONSTRAINT "company_owner_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "sales"."company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."company_owner" ADD CONSTRAINT "company_owner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
