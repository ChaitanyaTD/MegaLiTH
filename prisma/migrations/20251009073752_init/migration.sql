-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "xState" INTEGER NOT NULL DEFAULT 1,
    "xVerified" BOOLEAN NOT NULL DEFAULT false,
    "tgState" INTEGER NOT NULL DEFAULT 0,
    "refState" INTEGER NOT NULL DEFAULT 0,
    "referralCode" TEXT,
    "twitterId" TEXT,
    "twitterUserId" TEXT,
    "telegramId" BIGINT,
    "telegramUsername" TEXT,
    "twitterRefreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "referrerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBoost" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bnbBalance" TEXT NOT NULL DEFAULT '0',
    "asterBalance" TEXT NOT NULL DEFAULT '0',
    "kiltBalance" TEXT NOT NULL DEFAULT '0',
    "boostCoefficient" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "hasBnbBoost" BOOLEAN NOT NULL DEFAULT false,
    "hasAsterBoost" BOOLEAN NOT NULL DEFAULT false,
    "hasKiltBoost" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBoost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_key" ON "UserProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_referralCode_key" ON "UserProgress"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_twitterId_key" ON "UserProgress"("twitterId");

-- CreateIndex
CREATE INDEX "UserProgress_xState_xVerified_idx" ON "UserProgress"("xState", "xVerified");

-- CreateIndex
CREATE INDEX "UserProgress_referralCode_idx" ON "UserProgress"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_address_key" ON "Admin"("address");

-- CreateIndex
CREATE INDEX "Admin_address_idx" ON "Admin"("address");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_createdAt_idx" ON "Referral"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_userId_referrerId_key" ON "Referral"("userId", "referrerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBoost_userId_key" ON "UserBoost"("userId");

-- CreateIndex
CREATE INDEX "UserBoost_boostCoefficient_idx" ON "UserBoost"("boostCoefficient");

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "UserProgress"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBoost" ADD CONSTRAINT "UserBoost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
