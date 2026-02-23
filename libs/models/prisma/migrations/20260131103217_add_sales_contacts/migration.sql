-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sales";

-- CreateTable
CREATE TABLE "sales"."contact" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "linkedin_id" TEXT,
    "notes" TEXT,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."contact_owner" (
    "id" SERIAL NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_owner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_is_hidden_idx" ON "sales"."contact"("is_hidden");

-- CreateIndex
CREATE INDEX "contact_email_idx" ON "sales"."contact"("email");

-- CreateIndex
CREATE INDEX "contact_phone_idx" ON "sales"."contact"("phone");

-- CreateIndex
CREATE INDEX "contact_linkedin_id_idx" ON "sales"."contact"("linkedin_id");

-- CreateIndex
CREATE INDEX "contact_owner_user_id_idx" ON "sales"."contact_owner"("user_id");

-- CreateIndex
CREATE INDEX "contact_owner_contact_id_idx" ON "sales"."contact_owner"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_owner_contact_id_user_id_key" ON "sales"."contact_owner"("contact_id", "user_id");

-- AddForeignKey
ALTER TABLE "sales"."contact_owner" ADD CONSTRAINT "contact_owner_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sales"."contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."contact_owner" ADD CONSTRAINT "contact_owner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
