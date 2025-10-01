import { NextRequest } from "next/server";
import fetch from "node-fetch";
import { prisma } from "@/lib/prisma";

type TelegramChatMemberResponse = {
  ok: boolean;
  result?: { status: string; user: { id: number } };
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET)
    return new Response("Unauthorized", { status: 401 });

  const { telegramId } = await req.json();
  if (!telegramId) return new Response("telegramId required", { status: 400 });

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
  const GROUP_ID = process.env.TELEGRAM_GROUP_CHAT_ID!;

  const r = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${GROUP_ID}&user_id=${telegramId}`
  );

  const body: TelegramChatMemberResponse = (await r.json()) as TelegramChatMemberResponse;

  const verified =
    body.ok &&
    body.result &&
    ["member", "administrator", "creator"].includes(body.result.status);

  if (!verified)
    return new Response(JSON.stringify({ verified: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  const progress = await prisma.userProgress.findFirst({ where: { telegramId } });
  if (!progress) return new Response("User progress not found", { status: 404 });

  await prisma.userProgress.update({ where: { userId: progress.userId }, data: { tgState: 2 } });

  return new Response(JSON.stringify({ verified: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
