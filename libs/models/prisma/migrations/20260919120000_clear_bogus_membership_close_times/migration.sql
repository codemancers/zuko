-- Repair for closed_at being stamped on any accepted state change, not only a
-- terminal one. Every membership that saw an outbound event moved to 'active'
-- and picked up a close time it never had, which would have reported campaign
-- durations as ending the moment the first message went out.
--
-- A membership that is not in a terminal state has not closed, by definition.
UPDATE "sales"."campaign_membership"
SET "closed_at" = NULL
WHERE "closed_at" IS NOT NULL
  AND "state" NOT IN ('completed', 'removed');
