-- AlterTable
ALTER TABLE "public"."UserProgress" ADD COLUMN     "telegramUsername" TEXT,
ALTER COLUMN "telegramId" SET DATA TYPE TEXT;
