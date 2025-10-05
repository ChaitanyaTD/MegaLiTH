import { prisma } from "@/lib/prisma";
import { generateCode } from "@/utils/generateCode";

export async function generateReferral(address: string, type: 'twitter' | 'telegram') {
  const user = await prisma.user.findUnique({ 
    where: { address }, 
    include: { progress: true } 
  });
  
  if (!user || !user.progress) {
    throw new Error("User not found");
  }

  const { twitterId, telegramUsername } = user.progress;

  // Validate based on selected type
  if (type === 'twitter' && !twitterId) {
    throw new Error("Twitter verification required");
  }

  if (type === 'telegram' && !telegramUsername) {
    throw new Error("Telegram verification required");
  }

  // Generate referral code
  const referralCode = generateCode();
  
  // Update database - refState: 3 means COMPLETED
  await prisma.userProgress.update({ 
    where: { userId: user.id }, 
    data: { 
      referralCode, 
      refState: 3  // Changed from 1 to 3
    } 
  });

  // Choose username based on type
  const username = type === 'twitter' ? twitterId : telegramUsername;
  
  // Build referral link
  const referralLink = `${process.env.NEXT_PUBLIC_SITE_URL}/${username}/${referralCode}`;

  return {
    referralCode,
    referralLink,
    type,
    username,
  };
}