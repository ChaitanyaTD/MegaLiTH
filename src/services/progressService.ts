import { prisma } from "@/lib/prisma";

export async function getProgress(address: string) {
  const user = await prisma.user.findUnique({ where: { address }, include: { progress: true } });
  return user?.progress ?? null;
}

export async function upsertProgress(userId: number, data: Partial<{ xState: number; tgState: number; refState: number }>) {
  return prisma.userProgress.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}
