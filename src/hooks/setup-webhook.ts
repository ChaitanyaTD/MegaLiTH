// scripts/setup-webhook.ts
import "dotenv/config";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const WEBHOOK_URL = process.env.NEXTAUTH_URL! + "/api/telegram-webhook";

async function setupWebhook() {
  try {
    console.log("🔧 Setting up Telegram webhook...");
    console.log(`📍 Webhook URL: ${WEBHOOK_URL}`);

    if (!BOT_TOKEN) {
      console.error("❌ TELEGRAM_BOT_TOKEN not found in environment");
      process.exit(1);
    }

    if (!WEBHOOK_URL.startsWith("https://")) {
      console.error("❌ Webhook URL must use HTTPS");
      console.error(`Current URL: ${WEBHOOK_URL}`);
      process.exit(1);
    }

    // Step 1: Delete existing webhook
    console.log("\n🗑️  Deleting existing webhook...");
    const deleteRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`,
      { method: "POST" }
    );
    const deleteData = await deleteRes.json();
    console.log("Delete result:", deleteData);

    // Step 2: Set new webhook
    console.log("\n🔗 Setting new webhook...");
    const setRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          allowed_updates: ["message", "chat_member", "my_chat_member"],
          drop_pending_updates: true,
        }),
      }
    );

    const setData = await setRes.json();
    console.log("Set webhook result:", setData);

    if (!setData.ok) {
      console.error("❌ Failed to set webhook:", setData.description);
      process.exit(1);
    }

    // Step 3: Verify webhook
    console.log("\n✅ Verifying webhook...");
    const infoRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
    );
    const infoData = await infoRes.json();
    console.log("\n📊 Webhook Info:");
    console.log(JSON.stringify(infoData.result, null, 2));

    if (infoData.result?.url === WEBHOOK_URL) {
      console.log("\n🎉 Webhook setup successful!");
      console.log(`✅ URL: ${infoData.result.url}`);
      console.log(`✅ Pending updates: ${infoData.result.pending_update_count}`);
    } else {
      console.error("\n❌ Webhook URL mismatch!");
      console.error(`Expected: ${WEBHOOK_URL}`);
      console.error(`Got: ${infoData.result?.url}`);
    }
  } catch (err) {
    console.error("\n❌ Error setting up webhook:", err);
    process.exit(1);
  }
}

setupWebhook();