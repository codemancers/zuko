-- CreateTable
CREATE TABLE "sales"."prospect" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "icp_profile_id" INTEGER,
    "contact_id" INTEGER,
    "lead_id" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company_name" TEXT,
    "title" TEXT,
    "linkedin_url" TEXT,
    "apollo_person_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "email_consent" TEXT NOT NULL DEFAULT 'unknown',
    "linkedin_consent" TEXT NOT NULL DEFAULT 'unknown',
    "phone_consent" TEXT NOT NULL DEFAULT 'unknown',
    "fields" JSONB NOT NULL DEFAULT '{}',
    "notes" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."campaign_membership" (
    "id" SERIAL NOT NULL,
    "prospect_id" INTEGER NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'identified',
    "engagement" TEXT NOT NULL DEFAULT 'not_contacted',
    "disposition" TEXT,
    "enrolled_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."campaign_event" (
    "id" SERIAL NOT NULL,
    "membership_id" INTEGER NOT NULL,
    "prospect_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prospect_lead_id_key" ON "sales"."prospect"("lead_id");

-- CreateIndex
CREATE INDEX "prospect_organization_id_idx" ON "sales"."prospect"("organization_id");

-- CreateIndex
CREATE INDEX "prospect_organization_id_status_idx" ON "sales"."prospect"("organization_id", "status");

-- CreateIndex
CREATE INDEX "prospect_icp_profile_id_idx" ON "sales"."prospect"("icp_profile_id");

-- CreateIndex
CREATE INDEX "prospect_contact_id_idx" ON "sales"."prospect"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "prospect_organization_id_email_key" ON "sales"."prospect"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "prospect_organization_id_apollo_person_id_key" ON "sales"."prospect"("organization_id", "apollo_person_id");

-- CreateIndex
CREATE UNIQUE INDEX "prospect_organization_id_linkedin_url_key" ON "sales"."prospect"("organization_id", "linkedin_url");

-- CreateIndex
CREATE INDEX "campaign_membership_prospect_id_idx" ON "sales"."campaign_membership"("prospect_id");

-- CreateIndex
CREATE INDEX "campaign_membership_campaign_id_idx" ON "sales"."campaign_membership"("campaign_id");

-- CreateIndex
CREATE INDEX "campaign_membership_campaign_id_state_idx" ON "sales"."campaign_membership"("campaign_id", "state");

-- CreateIndex
CREATE INDEX "campaign_membership_state_idx" ON "sales"."campaign_membership"("state");

-- CreateIndex
CREATE INDEX "campaign_membership_engagement_idx" ON "sales"."campaign_membership"("engagement");

-- CreateIndex
CREATE INDEX "campaign_event_membership_id_occurred_at_idx" ON "sales"."campaign_event"("membership_id", "occurred_at");

-- CreateIndex
CREATE INDEX "campaign_event_prospect_id_occurred_at_idx" ON "sales"."campaign_event"("prospect_id", "occurred_at");

-- CreateIndex
CREATE INDEX "campaign_event_event_type_idx" ON "sales"."campaign_event"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_event_membership_id_external_id_key" ON "sales"."campaign_event"("membership_id", "external_id");

-- AddForeignKey
ALTER TABLE "sales"."prospect" ADD CONSTRAINT "prospect_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."prospect" ADD CONSTRAINT "prospect_icp_profile_id_fkey" FOREIGN KEY ("icp_profile_id") REFERENCES "sales"."icp_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."prospect" ADD CONSTRAINT "prospect_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sales"."contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."prospect" ADD CONSTRAINT "prospect_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "sales"."lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."campaign_membership" ADD CONSTRAINT "campaign_membership_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "sales"."prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."campaign_membership" ADD CONSTRAINT "campaign_membership_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "sales"."campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."campaign_event" ADD CONSTRAINT "campaign_event_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "sales"."campaign_membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."campaign_event" ADD CONSTRAINT "campaign_event_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "sales"."prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
