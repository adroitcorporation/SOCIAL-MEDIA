-- AlterTable
ALTER TABLE "EventAttachment" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "storagePath" TEXT;
