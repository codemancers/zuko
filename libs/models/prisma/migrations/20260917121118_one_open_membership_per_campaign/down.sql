-- Rollback for 20260917121118_one_open_membership_per_campaign.
DROP INDEX IF EXISTS "sales"."campaign_membership_one_open_per_campaign";
