-- Rollback for 20260917123131_add_membership_channel_and_audit_metadata.
-- Drops the audit trail and channel binding; the lifecycle tables survive.
DROP INDEX IF EXISTS "sales"."campaign_event_actor_id_idx";
DROP INDEX IF EXISTS "sales"."campaign_membership_next_eligible_at_idx";
ALTER TABLE "sales"."campaign_event" DROP COLUMN IF EXISTS "actor_id";
ALTER TABLE "sales"."campaign_event" DROP COLUMN IF EXISTS "source";
ALTER TABLE "sales"."campaign_membership" DROP COLUMN IF EXISTS "channel";
ALTER TABLE "sales"."campaign_membership" DROP COLUMN IF EXISTS "next_eligible_at";
