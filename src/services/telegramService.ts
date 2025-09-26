import fetch from "node-fetch";
import { prisma } from "@/lib/prisma";

export async function verifyTelegram(address: string, telegramUserId: number) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
  const TELEGRAM_GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID!;
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${TELEGRAM_GROUP_CHAT_ID}&user_id=${telegramUserId}`);
  const data = await res.json() as {
    ok: boolean;
    result?: { status: string };
  };
  const verified = data.ok && data.result && ["member", "administrator", "creator"].includes(data.result.status);

  if (verified) {
    const user = await prisma.user.findUnique({ where: { address } });
    if (!user) throw new Error("User not found");
    await prisma.userProgress.update({ where: { userId: user.id }, data: { tgState: 2, telegramId: telegramUserId } });
  }

  return verified;
}
