-- CreateIndex
CREATE INDEX "Message_channelId_deleted_createdAt_idx" ON "Message"("channelId", "deleted", "createdAt");
