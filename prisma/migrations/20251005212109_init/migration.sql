-- AlterTable
ALTER TABLE "UserProgress" ADD COLUMN     "xVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "UserProgress_xState_xVerified_idx" ON "UserProgress"("xState", "xVerified");
