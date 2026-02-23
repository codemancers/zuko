-- CreateTable
CREATE TABLE "sales"."account" (
    "id" SERIAL NOT NULL,
    "company_name" TEXT NOT NULL,
    "website" TEXT,
    "linkedin_url" TEXT,
    "summary" TEXT,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."account_contact" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "role" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."account_owner" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_owner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_is_hidden_idx" ON "sales"."account"("is_hidden");

-- CreateIndex
CREATE INDEX "account_company_name_idx" ON "sales"."account"("company_name");

-- CreateIndex
CREATE INDEX "account_contact_account_id_idx" ON "sales"."account_contact"("account_id");

-- CreateIndex
CREATE INDEX "account_contact_contact_id_idx" ON "sales"."account_contact"("contact_id");

-- CreateIndex
CREATE INDEX "account_contact_left_at_idx" ON "sales"."account_contact"("left_at");

-- CreateIndex
CREATE INDEX "account_owner_user_id_idx" ON "sales"."account_owner"("user_id");

-- CreateIndex
CREATE INDEX "account_owner_account_id_idx" ON "sales"."account_owner"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_owner_account_id_user_id_key" ON "sales"."account_owner"("account_id", "user_id");

-- AddForeignKey
ALTER TABLE "sales"."account_contact" ADD CONSTRAINT "account_contact_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "sales"."account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."account_contact" ADD CONSTRAINT "account_contact_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sales"."contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."account_owner" ADD CONSTRAINT "account_owner_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "sales"."account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."account_owner" ADD CONSTRAINT "account_owner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
