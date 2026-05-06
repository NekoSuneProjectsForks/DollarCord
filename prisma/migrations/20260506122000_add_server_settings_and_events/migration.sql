-- CreateTable
CREATE TABLE "ServerUserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "allowDms" BOOLEAN NOT NULL DEFAULT true,
    "messageRequests" BOOLEAN NOT NULL DEFAULT false,
    "shareActivity" BOOLEAN NOT NULL DEFAULT true,
    "activityJoining" BOOLEAN NOT NULL DEFAULT true,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "notificationLevel" TEXT NOT NULL DEFAULT 'ALL_MESSAGES',
    "suppressEveryone" BOOLEAN NOT NULL DEFAULT false,
    "suppressRoleMentions" BOOLEAN NOT NULL DEFAULT false,
    "suppressHighlights" BOOLEAN NOT NULL DEFAULT false,
    "muteNewEvents" BOOLEAN NOT NULL DEFAULT false,
    "mobilePushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "inAppEventAlerts" BOOLEAN NOT NULL DEFAULT true,
    "pushEventAlerts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServerUserSettings_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerUserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServerEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "channelId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "canceled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServerEvent_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerEvent_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServerEvent_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServerEventParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notify" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServerEventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ServerEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerEventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ServerUserSettings_serverId_userId_key" ON "ServerUserSettings"("serverId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ServerEventParticipant_eventId_userId_key" ON "ServerEventParticipant"("eventId", "userId");
