-- Rollback for 20260919090000_outreach_independent_of_campaigns.
-- Destructive: touches not tied to a campaign cannot exist in the old shape.
DELETE FROM "sales"."campaign_event" WHERE "membership_id" IS NULL;
DROP INDEX IF EXISTS "sales"."campaign_event_channel_idx";
ALTER TABLE "sales"."campaign_event" DROP COLUMN "channel", DROP COLUMN "direction";
ALTER TABLE "sales"."campaign_event" ALTER COLUMN "membership_id" SET NOT NULL;
UPDATE "sales"."campaign" SET "external_type" = 'apollo' WHERE "external_type" IS NULL;
ALTER TABLE "sales"."campaign" ALTER COLUMN "external_type" SET NOT NULL;
ALTER TABLE "sales"."campaign" ALTER COLUMN "external_type" SET DEFAULT 'apollo';
