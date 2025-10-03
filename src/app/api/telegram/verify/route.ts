// app/api/telegram/verify/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type TelegramChatMemberResponse = {
  ok: boolean;
  result?: {
    status: string;
    user: { id: number };
  };
};

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ verified: false, message: "address required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Find user and progress
    const user = await prisma.user.findUnique({
      where: { address },
      include: { progress: true },
    });

    if (!user || !user.progress || !user.progress.telegramId) {
      return new Response(
        JSON.stringify({
          verified: false,
          message: "User not found or hasn't started bot",
          tgState: 0,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const telegramId = Number(user.progress.telegramId);
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
    const GROUP_ID = process.env.TELEGRAM_GROUP_CHAT_ID!;

    // Check membership via Telegram API
    const verifyRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${GROUP_ID}&user_id=${telegramId}`
    );

    const verifyData: TelegramChatMemberResponse = await verifyRes.json();

    const joinedStatuses = ["member", "administrator", "creator"];
    const isVerified =
      verifyData.ok &&
      verifyData.result &&
      joinedStatuses.includes(verifyData.result.status);

    let newTgState = user.progress.tgState;

    if (isVerified && user.progress.tgState !== 3) {
      // Update state to 3 = verified & joined
      await prisma.userProgress.update({
        where: { userId: user.id },
        data: { tgState: 3 },
      });
      newTgState = 3;
      console.log(`✅ User ${address} verified and updated to tgState 3`);
    }

    return new Response(
      JSON.stringify({
        verified: isVerified,
        tgState: newTgState,
        status: verifyData.result?.status || "unknown",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error in /api/telegram/verify:", error);
    return new Response(
      JSON.stringify({
        verified: false,
        tgState: 0,
        message: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
