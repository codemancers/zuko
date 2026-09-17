-- AlterTable
ALTER TABLE "sales"."campaign_event" ADD COLUMN     "actor_id" INTEGER,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'system';

-- AlterTable
ALTER TABLE "sales"."campaign_membership" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'email',
ADD COLUMN     "next_eligible_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "campaign_event_actor_id_idx" ON "sales"."campaign_event"("actor_id");

-- CreateIndex
CREATE INDEX "campaign_membership_next_eligible_at_idx" ON "sales"."campaign_membership"("next_eligible_at");
