// app/api/telegram/complete/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type TelegramChatMemberResponse = {
  ok: boolean;
  result?: { 
    status: string; 
    user: { id: number } 
  };
  description?: string;
};

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-webhook-secret");
    if (secret !== process.env.STATE_SECRET) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { 
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { telegramId, username, firstName, lastName } = await req.json();
    
    if (!telegramId) {
      return new Response(JSON.stringify({ success: false, message: "telegramId required" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`📥 Received join notification for telegramId: ${telegramId}`);

    // Find user progress by telegramId
    const progress = await prisma.userProgress.findFirst({ 
      where: { telegramId: telegramId.toString() } 
    });
    
    if (!progress) {
      console.error(`❌ User progress not found for telegramId: ${telegramId}`);
      return new Response(JSON.stringify({ success: false, message: "User progress not found" }), { 
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // VERIFY: Actually check if user is in the group via Telegram API
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
    const GROUP_ID = process.env.TELEGRAM_GROUP_CHAT_ID!;

    console.log(`🔍 Verifying membership for telegramId: ${telegramId}`);

    const verifyRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${GROUP_ID}&user_id=${telegramId}`
    );

    const verifyData: TelegramChatMemberResponse = await verifyRes.json();

    console.log(`📋 Telegram API response:`, verifyData);

    // Check if user is actually a member
    const isVerified =
      verifyData.ok &&
      verifyData.result &&
      ["member", "administrator", "creator"].includes(verifyData.result.status);

    if (!isVerified) {
      console.error(`❌ User ${telegramId} is NOT in the group. Status: ${verifyData.result?.status || 'unknown'}`);
      return new Response(JSON.stringify({ 
        success: false, 
        message: "User is not a member of the group",
        verified: false 
      }), {
        status: 200, // Return 200 but with verified: false
        headers: { "Content-Type": "application/json" }
      });
    }

    // Update user progress to verified state (3)
    await prisma.userProgress.update({
      where: { userId: progress.userId },
      data: { 
        tgState: 3, // 3 = verified and joined
        telegramUsername: username || null,
      },
    });

    console.log(`✅ User ${telegramId} verified and updated to tgState: 3`);

    return new Response(JSON.stringify({ 
      success: true, 
      verified: true,
      message: "User verified successfully" 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error in /api/telegram/complete:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      verified: false,
      message: error instanceof Error ? error.message : "Internal server error" 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}