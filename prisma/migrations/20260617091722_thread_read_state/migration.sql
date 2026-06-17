-- CreateTable
CREATE TABLE "ThreadReadState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThreadReadState_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThreadReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ThreadReadState_userId_idx" ON "ThreadReadState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreadReadState_threadId_userId_key" ON "ThreadReadState"("threadId", "userId");
