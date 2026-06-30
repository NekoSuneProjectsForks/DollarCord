-- CreateTable
CREATE TABLE "ActivityHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PLAYING',
    "name" TEXT NOT NULL,
    "largeImage" TEXT,
    "details" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ActivityHistory_userId_lastSeenAt_idx" ON "ActivityHistory"("userId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityHistory_userId_name_key" ON "ActivityHistory"("userId", "name");
