// pages/api/telegram-webhook.ts (or app/api/telegram-webhook/route.ts for App Router)
import { Telegraf } from "telegraf";
import type { NextApiRequest, NextApiResponse } from "next";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const GROUP_ID = process.env.TELEGRAM_GROUP_CHAT_ID!;
const BACKEND_URL = process.env.NEXTAUTH_URL!;
const WEBHOOK_SECRET = process.env.STATE_SECRET!;

const bot = new Telegraf(BOT_TOKEN);

type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

type TelegramInviteResponse = {
  ok: boolean;
  result?: {
    invite_link: string;
    creator?: TelegramUser;
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

async function notifyBackend(
  endpoint: string,
  data: Record<string, unknown>
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

async function createInviteLink(): Promise<string | null> {
  const expireDate = Math.floor(Date.now() / 1000) + 3600; // +1 hour

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

// Bot handlers
bot.start(async (ctx) => {
  try {
    const payload = ctx.startPayload;
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.reply("❌ Unable to identify user. Please try again.");
      return;
    }

    if (payload) {
      await notifyBackend("/api/telegram/start-callback", {
        payload,
        telegramId,
      });
    }

    const inviteLink = await createInviteLink();

    if (!inviteLink) {
      await ctx.reply("❌ Failed to create invite link. Please try again later.");
      return;
    }

    const welcomeMessage = `✅ Click the link below to join the Telegram group:\n\n${inviteLink}\n\n⏱️ This link expires in 1 hour and can only be used once.\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n🎯 *Telegram*\n*COURSES*\n🎓 Learn & Grow Hub 🚀\nWelcome to the ultimate learning space! 🌟\n📚 Free Courses | 🎓 Skill Development | 🔥 Exclusive Content\n✨ Follow us for daily updates and start learning for free.\n\nJoin now and elevate your skills! 🚀\n\n*REQUEST TO JOIN*`;

    await ctx.reply(welcomeMessage, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Error in /start:", err);
    await ctx.reply("❌ Something went wrong. Please contact support.");
  }
});

bot.on("chat_member", async (ctx) => {
  try {
    const update = ctx.update.chat_member;
    if (!update) return;

    if (update.chat.id.toString() !== GROUP_ID.toString()) return;

    const telegramId = update.new_chat_member.user.id;
    const oldStatus = update.old_chat_member.status;
    const newStatus = update.new_chat_member.status;

    const joinedStatuses = ["member", "administrator", "creator"];
    const wasNotMember = !joinedStatuses.includes(oldStatus);
    const isNowMember = joinedStatuses.includes(newStatus);

    if (wasNotMember && isNowMember) {
      console.log(`User ${telegramId} joined the group`);
      
      const success = await notifyBackend("/api/telegram/complete", {
        telegramId,
        username: update.new_chat_member.user.username ?? null,
        firstName: update.new_chat_member.user.first_name ?? null,
        lastName: update.new_chat_member.user.last_name ?? null,
      });

      if (success) {
        console.log(`Successfully notified backend about user ${telegramId}`);
      }
    }
  } catch (err) {
    console.error("Error in chat_member handler:", err);
  }
});

// Webhook handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "POST") {
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } else if (req.method === "GET") {
      res.status(200).json({ status: "Telegram webhook is active" });
    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}