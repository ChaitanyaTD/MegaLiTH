import { prisma } from "@/lib/prisma";

interface ReferralJoinData {
  newUserAddress: string;
  referralCode: string;
}

export async function trackReferralJoin(data: ReferralJoinData) {
  const { newUserAddress, referralCode } = data;

  // 1️⃣ Validate referral code
  const referrerProgress = await prisma.userProgress.findUnique({
    where: { referralCode },
    include: { user: true },
  });

  if (!referrerProgress) {
    throw new Error("Invalid referral code");
  }

  // Prevent self-referral
  if (referrerProgress.user.address === newUserAddress) {
    throw new Error("You cannot use your own referral code");
  }

  // Run inside transaction for safety
  const result = await prisma.$transaction(async (tx) => {
    // 2️⃣ Get or create the new user
    let newUser = await tx.user.findUnique({
      where: { address: newUserAddress },
    });

    if (!newUser) {
      newUser = await tx.user.create({
        data: {
          address: newUserAddress,
          progress: { create: {} },
        },
        include: { progress: true },
      });
    }

    // 3️⃣ Ensure user not already referred
    const alreadyReferred = await tx.referral.findFirst({
      where: { userId: newUser.id },
    });

    if (alreadyReferred) {
      throw new Error("User already referred by someone else");
    }

    // 4️⃣ Create referral record (referrer can have multiple)
    const referral = await tx.referral.create({
      data: {
        userId: newUser.id,
        referrerId: referrerProgress.userId,
      },
    });

    return { referral, newUser };
  });

  return {
    success: true,
    referral: result.referral,
    referrer: referrerProgress.user.address,
    newUser: result.newUser.address,
  };
}

export async function getUserReferralStats(address: string) {
  const user = await prisma.user.findUnique({
    where: { address },
    include: {
      progress: {
        include: {
          referredUsers: {
            include: { user: true },
          },
        },
      },
    },
  });

  if (!user || !user.progress) {
    return null;
  }

  const referrals = user.progress.referredUsers ?? [];

  return {
    totalReferrals: referrals.length,
    referralCode: user.progress.referralCode,
    referredUsers: referrals.map((r) => ({
      address: r.user.address,
      joinedAt: r.createdAt,
    })),
  };
}
