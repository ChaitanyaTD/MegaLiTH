// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { telegramWebhookHandler } from "@/bot/webhook";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headers = Object.fromEntries(req.headers.entries());

    // Telegraf webhook callback expects Node.js req/res, so we use a minimal wrapper
    await telegramWebhookHandler(
      {
        body: JSON.parse(body),
        headers,
        method: "POST",
        url: req.url,
      } as any,
      {
        end: (result: any) => {
        },
        setHeader: () => {},
        getHeader: () => {},
        writeHead: () => {},
      } as any,
      () => {}
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Telegram webhook error:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
