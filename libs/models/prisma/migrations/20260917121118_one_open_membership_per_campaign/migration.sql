-- A prospect may hold at most one OPEN membership in a given campaign.
-- Closed memberships ('completed', 'removed') may repeat, so a prospect
-- nurtured out of a campaign can legitimately be re-enrolled into it later.
-- Prisma cannot express a partial unique index, so it is declared here.
CREATE UNIQUE INDEX "campaign_membership_one_open_per_campaign"
  ON "sales"."campaign_membership" ("prospect_id", "campaign_id")
  WHERE "state" IN ('identified', 'enrolled', 'active');
