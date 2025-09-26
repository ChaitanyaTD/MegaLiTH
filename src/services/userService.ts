import { prisma } from "@/lib/prisma";

export async function getUserByAddress(address: string) {
  return prisma.user.findUnique({ where: { address }, include: { progress: true } });
}

export async function createOrGetUser(address: string) {
  return prisma.user.upsert({
    where: { address },
    update: {},
    create: { address },
  });
}
