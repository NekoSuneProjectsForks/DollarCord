-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "joinUrl" TEXT;
ALTER TABLE "Activity" ADD COLUMN "partyCurrent" INTEGER;
ALTER TABLE "Activity" ADD COLUMN "partyId" TEXT;
ALTER TABLE "Activity" ADD COLUMN "partyMax" INTEGER;

-- AlterTable
ALTER TABLE "Server" ADD COLUMN "liveAnnounceChannelId" TEXT;
