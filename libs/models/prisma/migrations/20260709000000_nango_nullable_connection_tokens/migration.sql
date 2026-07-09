-- Nango now owns OAuth tokens; make access_token nullable so Connection records
-- can be created without token data (Nango stores tokens encrypted on its side).
ALTER TABLE "connection" ALTER COLUMN "access_token" DROP NOT NULL;
