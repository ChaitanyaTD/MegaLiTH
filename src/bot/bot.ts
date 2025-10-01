// bot.ts
import { Telegraf } from "telegraf";
import fetch from "node-fetch";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const GROUP_ID = process.env.TELEGRAM_GROUP_CHAT_ID!;
const BACKEND_URL = process.env.NEXTAUTH_URL!;
const WEBHOOK_SECRET = process.env.STATE_SECRET!;

if (!BOT_TOKEN || !GROUP_ID || !BACKEND_URL || !WEBHOOK_SECRET) {
  throw new Error("Missing environment variables for Telegram bot");
}

const bot = new Telegraf(BOT_TOKEN);

// /start handler — generates invite link
bot.start(async (ctx) => {
  try {
    const payload = ctx.startPayload; // user address if opened via deep link

    if (payload) {
      // optional: notify backend about who started the bot
      try {
        await fetch(`${BACKEND_URL}/api/telegram/start-callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": WEBHOOK_SECRET,
          },
          body: JSON.stringify({ payload, telegramId: ctx.from?.id }),
        });
      } catch (err) {
        console.error("Failed to notify backend:", err);
      }
    }

    // Generate one-time invite link (expires in 1 hour, 1 member)
    const invite = await ctx.telegram.createChatInviteLink(GROUP_ID, {
      expire_date: Math.floor(Date.now() / 1000) + 60 * 60,
      member_limit: 1,
    });

    await ctx.reply(
      `✅ Click the link below to join the Telegram group:\n\n${invite.invite_link}\n\nThis link expires in 1 hour.`
    );
  } catch (err) {
    console.error("Error in /start:", err);
    await ctx.reply("❌ Something went wrong. Please contact support.");
  }
});

// Detect when a user joins the group
bot.on("chat_member", async (ctx) => {
  const update = ctx.update.chat_member;
  if (!update) return;

  if (update.chat.id.toString() !== GROUP_ID.toString()) return;

  const telegramId = update.new_chat_member.user.id;
  const status = update.new_chat_member.status;

  if (["member", "administrator", "creator"].includes(status)) {
    try {
      await fetch(`${BACKEND_URL}/api/telegram/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": WEBHOOK_SECRET,
        },
        body: JSON.stringify({ telegramId }),
      });
    } catch (err) {
      console.error("Failed to notify backend:", err);
    }
  }
});

// Start the bot
bot.launch().then(() => console.log("Telegram bot started"));
