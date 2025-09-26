import { prisma } from "@/lib/prisma";
import { generateCode } from "@/utils/generateCode";

export async function generateReferral(address: string) {
  const user = await prisma.user.findUnique({ where: { address }, include: { progress: true } });
  if (!user || !user.progress || !user.progress.twitterId) throw new Error("Twitter verification required");

  const referralCode = generateCode();
  await prisma.userProgress.update({ where: { userId: user.id }, data: { referralCode, refState: 1 } });

  return {
    referralCode,
    referralLink: `https://yourwebsite.com/${user.progress.twitterId}/${referralCode}`,
  };
}
