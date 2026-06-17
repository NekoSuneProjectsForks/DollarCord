-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "type" TEXT NOT NULL DEFAULT 'PLAYING',
    "name" TEXT NOT NULL,
    "details" TEXT,
    "state" TEXT,
    "url" TEXT,
    "largeImage" TEXT,
    "smallImage" TEXT,
    "startedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Channel_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Channel" ("createdAt", "description", "id", "name", "position", "serverId", "updatedAt") SELECT "createdAt", "description", "id", "name", "position", "serverId", "updatedAt" FROM "Channel";
DROP TABLE "Channel";
ALTER TABLE "new_Channel" RENAME TO "Channel";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "twitchChannel" TEXT,
    "kickChannel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "customStatus" TEXT,
    "customStatusEmoji" TEXT,
    "usernameChangedAt" DATETIME,
    "rpcToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("avatarUrl", "bio", "createdAt", "displayName", "email", "id", "isPlatformAdmin", "kickChannel", "passwordHash", "twitchChannel", "updatedAt", "username") SELECT "avatarUrl", "bio", "createdAt", "displayName", "email", "id", "isPlatformAdmin", "kickChannel", "passwordHash", "twitchChannel", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_rpcToken_key" ON "User"("rpcToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Activity_userId_idx" ON "Activity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_userId_source_key" ON "Activity"("userId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
