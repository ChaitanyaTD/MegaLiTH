import { prisma } from "@/lib/prisma";
import { generateCode } from "@/utils/generateCode";

export async function generateReferral(address: string) {
  const user = await prisma.user.findUnique({
    where: { address },
    include: { progress: true },
  });

  if (!user || !user.progress) {
    throw new Error("User not found");
  }

  // ✅ If referral code already exists, reuse it
  if (user.progress.referralCode) {
    const referralLink = `${process.env.NEXTAUTH_URL}/?ref=${user.progress.referralCode}`;
    return {
      referralCode: user.progress.referralCode,
      referralLink,
    };
  }

  // ✅ Generate a unique referral code
  let referralCode = "";
  let isUnique = false;

  while (!isUnique) {
    referralCode = generateCode();

    const existing = await prisma.userProgress.findFirst({
      where: { referralCode },
      select: { id: true },
    });

    if (!existing) {
      isUnique = true;
    }
  }

  // ✅ Save the referral code to DB (refState: 3 = COMPLETED)
  await prisma.userProgress.update({
    where: { userId: user.id },
    data: {
      referralCode,
      refState: 3,
    },
  });

  const referralLink = `${process.env.NEXTAUTH_URL}/?ref=${referralCode}`;

  return {
    referralCode,
    referralLink,
  };
}
