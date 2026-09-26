-- DropIndex
DROP INDEX "Message_conversationId_createdAt_idx";

-- DropIndex
DROP INDEX "Idea_createdAt_idx";

-- DropIndex
DROP INDEX "Event_startsAt_idx";

-- CreateIndex
CREATE INDEX "User_accountStatus_onboarded_createdAt_id_idx" ON "User"("accountStatus", "onboarded", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_id_idx" ON "Message"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Idea_createdAt_id_idx" ON "Idea"("createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Event_startsAt_id_idx" ON "Event"("startsAt", "id");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
