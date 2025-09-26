/*
  Warnings:

  - A unique constraint covering the columns `[twitterId]` on the table `UserProgress` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[telegramId]` on the table `UserProgress` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."UserProgress" ADD COLUMN     "telegramId" INTEGER,
ADD COLUMN     "twitterId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_twitterId_key" ON "public"."UserProgress"("twitterId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_telegramId_key" ON "public"."UserProgress"("telegramId");
