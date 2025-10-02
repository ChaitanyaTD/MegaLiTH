// app/api/telegram/start-callback/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.STATE_SECRET)
    return new Response("Unauthorized", { status: 401 });

  const { payload: address, telegramId } = await req.json();
  if (!address || !telegramId) return new Response("Invalid body", { status: 400 });

  const user = await prisma.user.findUnique({ where: { address } });
  if (!user) return new Response("User not found", { status: 404 });

  await prisma.userProgress.upsert({
    where: { userId: user.id },
    update: { telegramId, tgState: 1 }, // 1 = started bot
    create: { userId: user.id, telegramId, tgState: 1 },
  });

  return new Response("OK");
}
