// bot.ts
import "dotenv/config";
import { Telegraf } from "telegraf";
import fetch from "node-fetch";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const GROUP_ID = process.env.TELEGRAM_GROUP_CHAT_ID!;
const BACKEND_URL = process.env.NEXTAUTH_URL!;
const WEBHOOK_SECRET = process.env.STATE_SECRET!;

// Validate environment variables
if (!BOT_TOKEN || !GROUP_ID || !BACKEND_URL || !WEBHOOK_SECRET) {
  console.error("❌ Missing environment variables:");
  console.error({
    BOT_TOKEN: BOT_TOKEN ? "✓ Set" : "✗ Missing",
    GROUP_ID: GROUP_ID ? "✓ Set" : "✗ Missing",
    BACKEND_URL: BACKEND_URL ? "✓ Set" : "✗ Missing",
    WEBHOOK_SECRET: WEBHOOK_SECRET ? "✓ Set" : "✗ Missing",
  });
  throw new Error("Missing environment variables for Telegram bot");
}

// Validate bot token format
if (!BOT_TOKEN.match(/^\d+:[A-Za-z0-9_-]{35}$/)) {
  console.error("❌ Invalid bot token format!");
  console.error("Expected format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890");
  console.error(`Received: ${BOT_TOKEN.substring(0, 10)}...`);
  throw new Error("Invalid bot token format");
}

const bot = new Telegraf(BOT_TOKEN);

// Type definitions
type TelegramInviteResponse = {
  ok: boolean;
  result?: {
    invite_link: string;
    creator?: any;
    creates_join_request?: boolean;
    is_primary?: boolean;
    is_revoked?: boolean;
    expire_date?: number;
    member_limit?: number;
    pending_join_request_count?: number;
  };
  description?: string;
};

type BackendResponse = {
  success: boolean;
  message?: string;
};

// Helper function to call backend
async function notifyBackend(
  endpoint: string,
  data: Record<string, any>
): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": WEBHOOK_SECRET,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      console.error(`Backend ${endpoint} failed:`, res.status, res.statusText);
      return false;
    }

    const result = (await res.json()) as BackendResponse;
    return result.success ?? false;
  } catch (err) {
    console.error(`Failed to notify backend at ${endpoint}:`, err);
    return false;
  }
}

// Helper function to create invite link
async function createInviteLink(): Promise<string | null> {
  const expireDate = Math.floor(Date.now() / 1000) + 60; // +1 hour

  try {
    const inviteRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/createChatInviteLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: GROUP_ID,
          expire_date: expireDate,
          member_limit: 1,
        }),
      }
    );

    const inviteData = (await inviteRes.json()) as TelegramInviteResponse;

    if (!inviteData.ok || !inviteData.result) {
      console.error("Failed to create invite link:", inviteData);
      return null;
    }

    return inviteData.result.invite_link;
  } catch (err) {
    console.error("Error creating invite link:", err);
    return null;
  }
}

// /start handler — generates invite link
bot.start(async (ctx) => {
  try {
    const payload = ctx.startPayload;
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.reply("❌ Unable to identify user. Please try again.");
      return;
    }

    // Notify backend about bot start
    if (payload) {
      await notifyBackend("/api/telegram/start-callback", {
        payload,
        telegramId,
      });
    }

    // Create invite link
    const inviteLink = await createInviteLink();

    if (!inviteLink) {
      await ctx.reply("❌ Failed to create invite link. Please try again later.");
      return;
    }

    await ctx.reply(
      `✅ Click the link below to join the Telegram group:\n\n${inviteLink}\n\n⏱️ This link expires in 1 hour and can only be used once.`
    );
  } catch (err) {
    console.error("Error in /start:", err);
    await ctx.reply("❌ Something went wrong. Please contact support.");
  }
});

// Detect when a user joins the group
bot.on("chat_member", async (ctx) => {
  try {
    const update = ctx.update.chat_member;
    if (!update) return;

    // Only process updates for our target group
    if (update.chat.id.toString() !== GROUP_ID.toString()) return;

    const telegramId = update.new_chat_member.user.id;
    const oldStatus = update.old_chat_member.status;
    const newStatus = update.new_chat_member.status;

    // Check if user actually joined (status changed from non-member to member)
    const joinedStatuses = ["member", "administrator", "creator"];
    const wasNotMember = !joinedStatuses.includes(oldStatus);
    const isNowMember = joinedStatuses.includes(newStatus);

    if (wasNotMember && isNowMember) {
      console.log(`User ${telegramId} joined the group`);
      
      const success = await notifyBackend("/api/telegram/complete", {
        telegramId,
        username: update.new_chat_member.user.username,
        firstName: update.new_chat_member.user.first_name,
        lastName: update.new_chat_member.user.last_name,
      });

      if (success) {
        console.log(`Successfully notified backend about user ${telegramId}`);
      }
    }
  } catch (err) {
    console.error("Error in chat_member handler:", err);
  }
});

// Graceful shutdown
process.once("SIGINT", () => {
  console.log("Received SIGINT, stopping bot...");
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  console.log("Received SIGTERM, stopping bot...");
  bot.stop("SIGTERM");
});

// Start the bot
bot.launch().then(() => {
  console.log("✅ Telegram bot started successfully");
  console.log(`📱 Bot username: @${bot.botInfo?.username}`);
  console.log(`👥 Target group ID: ${GROUP_ID}`);
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));