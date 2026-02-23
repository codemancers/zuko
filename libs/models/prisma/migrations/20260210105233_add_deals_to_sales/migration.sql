-- CreateTable
CREATE TABLE "sales"."deal" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "value" DECIMAL(15,2),
    "currency" TEXT DEFAULT 'USD',
    "probability" INTEGER DEFAULT 50,
    "stage" TEXT NOT NULL DEFAULT 'prospecting',
    "summary" TEXT,
    "expected_close_date" TIMESTAMP(3),
    "actual_close_date" TIMESTAMP(3),
    "lost_reason" TEXT,
    "source" TEXT,
    "priority" INTEGER DEFAULT 2,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."deal_account" (
    "id" SERIAL NOT NULL,
    "deal_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."deal_contact" (
    "id" SERIAL NOT NULL,
    "deal_id" INTEGER NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "role" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."deal_owner" (
    "id" SERIAL NOT NULL,
    "deal_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_owner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_is_hidden_idx" ON "sales"."deal"("is_hidden");

-- CreateIndex
CREATE INDEX "deal_stage_idx" ON "sales"."deal"("stage");

-- CreateIndex
CREATE INDEX "deal_expected_close_date_idx" ON "sales"."deal"("expected_close_date");

-- CreateIndex
CREATE INDEX "deal_actual_close_date_idx" ON "sales"."deal"("actual_close_date");

-- CreateIndex
CREATE INDEX "deal_created_at_idx" ON "sales"."deal"("created_at");

-- CreateIndex
CREATE INDEX "deal_account_deal_id_idx" ON "sales"."deal_account"("deal_id");

-- CreateIndex
CREATE INDEX "deal_account_account_id_idx" ON "sales"."deal_account"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "deal_account_deal_id_account_id_key" ON "sales"."deal_account"("deal_id", "account_id");

-- CreateIndex
CREATE INDEX "deal_contact_deal_id_idx" ON "sales"."deal_contact"("deal_id");

-- CreateIndex
CREATE INDEX "deal_contact_contact_id_idx" ON "sales"."deal_contact"("contact_id");

-- CreateIndex
CREATE INDEX "deal_contact_role_idx" ON "sales"."deal_contact"("role");

-- CreateIndex
CREATE UNIQUE INDEX "deal_contact_deal_id_contact_id_key" ON "sales"."deal_contact"("deal_id", "contact_id");

-- CreateIndex
CREATE INDEX "deal_owner_user_id_idx" ON "sales"."deal_owner"("user_id");

-- CreateIndex
CREATE INDEX "deal_owner_deal_id_idx" ON "sales"."deal_owner"("deal_id");

-- CreateIndex
CREATE UNIQUE INDEX "deal_owner_deal_id_user_id_key" ON "sales"."deal_owner"("deal_id", "user_id");

-- AddForeignKey
ALTER TABLE "sales"."deal_account" ADD CONSTRAINT "deal_account_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "sales"."deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."deal_account" ADD CONSTRAINT "deal_account_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "sales"."account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."deal_contact" ADD CONSTRAINT "deal_contact_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "sales"."deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."deal_contact" ADD CONSTRAINT "deal_contact_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sales"."contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."deal_owner" ADD CONSTRAINT "deal_owner_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "sales"."deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."deal_owner" ADD CONSTRAINT "deal_owner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
