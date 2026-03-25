-- AlterTable
ALTER TABLE "PendingOrder" ADD COLUMN "additionalInfoFileData" BYTEA,
ADD COLUMN "additionalInfoFileName" TEXT;
