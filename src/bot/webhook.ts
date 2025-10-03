// src/bot/webhook.ts
import { Telegraf } from "telegraf";
import fetch from "node-fetch";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const GROUP_ID = process.env.TELEGRAM_GROUP_CHAT_ID!;
const BACKEND_URL = process.env.NEXTAUTH_URL!;
const WEBHOOK_SECRET = process.env.STATE_SECRET!;

if (!BOT_TOKEN || !GROUP_ID || !BACKEND_URL || !WEBHOOK_SECRET) {
  throw new Error("Missing required environment variables for Telegram bot");
}

const bot = new Telegraf(BOT_TOKEN);

// --- Helper to notify backend ---
type BackendResponse = { success: boolean; message?: string };

async function notifyBackend(endpoint: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": WEBHOOK_SECRET,
      },
      body: JSON.stringify(data),
    });

    const text = await res.text();
    let result: BackendResponse;
    try {
      result = JSON.parse(text);
    } catch {
      result = { success: false, message: text };
    }

    return result.success ?? false;
  } catch (err) {
    console.error("❌ Failed to notify backend:", err);
    return false;
  }
}

// --- Helper to create single-use invite link ---
async function createInviteLink(): Promise<string | null> {
  try {
    const expireDate = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: GROUP_ID,
        expire_date: expireDate,
        member_limit: 1,
      }),
    });

    const data = await res.json() as { ok: boolean; result?: { invite_link: string } };
    if (data.ok && data.result) return data.result.invite_link;
    console.error("❌ Failed to create invite link", data);
    return null;
  } catch (err) {
    console.error("❌ Error creating invite link:", err);
    return null;
  }
}

// --- /start handler ---
bot.start(async (ctx) => {
  const telegramId = ctx.from?.id;
  const payload = ctx.startPayload;

  if (!telegramId) {
    await ctx.reply("❌ Unable to identify user. Please try again.");
    return;
  }

  console.log("🤖 /start received", { telegramId, payload });

  if (payload) {
    const success = await notifyBackend("/api/telegram/start-callback", { payload, telegramId });
    if (!success) {
      await ctx.reply("❌ Failed to link your account. Please try again.");
      return;
    }
  }

  const inviteLink = await createInviteLink();
  if (!inviteLink) {
    await ctx.reply("❌ Failed to create invite link. Please try later.");
    return;
  }

  const welcomeMessage = `✅ Click to join the Telegram group:\n\n${inviteLink}\n\n⏱️ Expires in 1 hour.`;
  await ctx.reply(welcomeMessage);
  console.log(`✅ Invite link sent to ${telegramId}`);
});

// --- chat_member handler ---
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
    console.log(`✅ User ${telegramId} joined the group`);
    await notifyBackend("/api/telegram/complete", {
      telegramId,
      username: update.new_chat_member.user.username ?? null,
      firstName: update.new_chat_member.user.first_name ?? null,
      lastName: update.new_chat_member.user.last_name ?? null,
    });
  }
});

// --- Export webhook callback for Vercel ---
export const telegramWebhookHandler = bot.webhookCallback("/api/telegram/webhook");
