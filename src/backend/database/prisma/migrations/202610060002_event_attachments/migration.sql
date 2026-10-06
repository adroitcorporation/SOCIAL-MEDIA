CREATE TABLE "EventAttachment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAttachment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EventAttachment" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "EventAttachment_eventId_createdAt_id_idx"
ON "EventAttachment"("eventId", "createdAt", "id");

CREATE INDEX "EventAttachment_ownerId_idx"
ON "EventAttachment"("ownerId");

ALTER TABLE "EventAttachment"
ADD CONSTRAINT "EventAttachment_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventAttachment"
ADD CONSTRAINT "EventAttachment_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventAttachment"
ADD CONSTRAINT "EventAttachment_size_check"
CHECK ("size" > 0 AND "size" <= 8000000);

ALTER TABLE "EventAttachment"
ADD CONSTRAINT "EventAttachment_mimeType_check"
CHECK ("mimeType" IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp'));
