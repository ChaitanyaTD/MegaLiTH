// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { telegramWebhookHandler } from "@/bot/webhook";

// Minimal Node-like request for Telegraf
interface MiniRequest {
  body: any; // Use 'any' here to avoid type issues
  headers: Record<string, string>;
  method: string;
  url: string;
}

// Minimal Node-like response for Telegraf
class MiniResponse {
  end(_: unknown) {}
  setHeader(_: string, __: string) {}
  getHeader(_: string) { return undefined; }
  writeHead(_: number, __?: Record<string, string>) {}
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);
    const headers = Object.fromEntries(req.headers.entries());

    const nodeReq: MiniRequest = {
      body,
      headers,
      method: "POST",
      url: req.url,
    };

    const nodeRes = new MiniResponse();

    // Telegraf webhook handler
    await telegramWebhookHandler(nodeReq as any, nodeRes as any, () => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Telegram webhook error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
