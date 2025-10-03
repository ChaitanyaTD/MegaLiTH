import "dotenv/config";
import { Telegraf } from "telegraf";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const GROUP_ID = process.env.TELEGRAM_GROUP_CHAT_ID!;
const BACKEND_URL = process.env.NEXTAUTH_URL!;
const WEBHOOK_SECRET = process.env.STATE_SECRET!;

if (!BOT_TOKEN || !GROUP_ID || !BACKEND_URL || !WEBHOOK_SECRET) {
  throw new Error("Missing required env variables for Telegram bot");
}

export const bot = new Telegraf(BOT_TOKEN);

// Helper: Notify backend
async function notifyBackend(endpoint: string, data: Record<string, unknown>) {
  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": WEBHOOK_SECRET,
      },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    return json.success === true;
  } catch (err) {
    console.error("❌ Backend notification failed:", err);
    return false;
  }
}

// Helper: Create one-time invite link
async function createInviteLink(): Promise<string | null> {
  const expireDate = Math.floor(Date.now() / 1000) + 3600; // 1 hour

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/createChatInviteLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: GROUP_ID, expire_date: expireDate, member_limit: 1 }),
      }
    );
    const data = await res.json();
    if (data.ok && data.result?.invite_link) return data.result.invite_link;
    console.error("❌ Failed to create invite link:", data);
    return null;
  } catch (err) {
    console.error("❌ Error creating invite link:", err);
    return null;
  }
}

// /start command
bot.start(async (ctx) => {
  const payload = ctx.startPayload;
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply("❌ Unable to identify user. Please try again.");
    return;
  }

  if (payload) {
    const success = await notifyBackend("/api/telegram/start-callback", {
      payload,
      telegramId,
    });

    if (!success) {
      await ctx.reply("❌ Failed to link your account. Please try again.");
      return;
    }
  }

  const inviteLink = await createInviteLink();
  if (!inviteLink) {
    await ctx.reply("❌ Failed to create invite link. Please try again later.");
    return;
  }

  await ctx.reply(
    `✅ Click to join group:\n\n${inviteLink}\n\n⏱️ Expires in 1 hour, one-time use.`,
    { parse_mode: "Markdown" }
  );
});

// chat_member updates
bot.on("chat_member", async (ctx) => {
  const update = ctx.update.chat_member;
  if (!update || update.chat.id.toString() !== GROUP_ID.toString()) return;

  const telegramId = update.new_chat_member.user.id;
  const oldStatus = update.old_chat_member.status;
  const newStatus = update.new_chat_member.status;

  const joinedStatuses = ["member", "administrator", "creator"];
  const wasNotMember = !joinedStatuses.includes(oldStatus);
  const isNowMember = joinedStatuses.includes(newStatus);

  if (wasNotMember && isNowMember) {
    await notifyBackend("/api/telegram/complete", {
      telegramId,
      username: update.new_chat_member.user.username ?? null,
      firstName: update.new_chat_member.user.first_name ?? null,
      lastName: update.new_chat_member.user.last_name ?? null,
    });
  }
});
