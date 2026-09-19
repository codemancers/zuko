-- Zuko is the system of record; Apollo, Origami and Salesforce are sources
-- that feed it. Two consequences:
--
--  1. A campaign created in Zuko is not an Apollo campaign. external_type
--     loses its 'apollo' default and becomes null until the campaign is
--     actually linked to an external sequence.
--  2. Outreach is a touch against a PROSPECT. A campaign is optional context,
--     so a one-off call or email can be recorded without inventing a campaign
--     to hang it on. Every touch declares its channel, because consent is per
--     channel.

ALTER TABLE "sales"."campaign" ALTER COLUMN "external_type" DROP DEFAULT;
ALTER TABLE "sales"."campaign" ALTER COLUMN "external_type" DROP NOT NULL;

ALTER TABLE "sales"."campaign_event" ALTER COLUMN "membership_id" DROP NOT NULL;
ALTER TABLE "sales"."campaign_event"
  ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'outbound';

-- Existing touches inherit the channel of the membership they came from.
UPDATE "sales"."campaign_event" e
SET "channel" = m."channel"
FROM "sales"."campaign_membership" m
WHERE e."membership_id" = m."id";

-- Replies are inbound; everything else we initiated.
UPDATE "sales"."campaign_event"
SET "direction" = 'inbound'
WHERE "event_type" IN ('reply_received', 'opted_out', 'meeting_booked');

CREATE INDEX "campaign_event_channel_idx" ON "sales"."campaign_event" ("channel");
