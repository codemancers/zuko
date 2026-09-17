-- Rollback for 20260917121110_add_prospect_and_campaign_membership.
-- Prisma Migrate has no native down step, so rollbacks are kept here and
-- applied by hand: psql "$DATABASE_URL" -f <this file>.
-- Destructive: drops every prospect, membership and campaign event.
DROP TABLE IF EXISTS "sales"."campaign_event";
DROP TABLE IF EXISTS "sales"."campaign_membership";
DROP TABLE IF EXISTS "sales"."prospect";
