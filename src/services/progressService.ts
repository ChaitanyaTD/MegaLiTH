import { prisma } from "@/lib/prisma";

export async function getProgress(address: string) {
  const user = await prisma.user.findUnique({ 
    where: { address }, 
    include: { progress: true } 
  });
  
  if (!user || !user.progress) return null;
  
  // Return combined data with address from User model
  return {
    ...user.progress,
    address: user.address, // Add address to the progress object
  };
}

export async function upsertProgress(
  userId: number, 
  data: Partial<{ xState: number; tgState: number; refState: number }>
) {
  const progress = await prisma.userProgress.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
    include: {
      user: true, // Include user to get address
    },
  });
  
  // Return progress with address
  return {
    ...progress,
    address: progress.user.address,
  };
}