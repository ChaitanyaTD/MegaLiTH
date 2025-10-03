/*
  Warnings:

  - The `telegramId` column on the `UserProgress` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."UserProgress" DROP COLUMN "telegramId",
ADD COLUMN     "telegramId" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_telegramId_key" ON "public"."UserProgress"("telegramId");
