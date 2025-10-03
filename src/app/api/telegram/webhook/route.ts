// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { telegramWebhookHandler } from "@/bot/webhook";

// Minimal Node-like request for Telegraf
interface MiniRequest {
  body: Record<string, unknown>;
  headers: Record<string, string>;
  method: string;
  url: string;
}

// Minimal Node-like response for Telegraf
interface MiniResponse {
  end(data?: unknown): void;
  setHeader(name: string, value: string): void;
  getHeader(name: string): string | undefined;
  writeHead(statusCode: number, headers?: Record<string, string>): void;
}

class MiniResponseImpl implements MiniResponse {
  end(_data?: unknown) {}
  setHeader(_name: string, _value: string) {}
  getHeader(_name: string) { return undefined; }
  writeHead(_statusCode: number, _headers?: Record<string, string>) {}
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const body: Record<string, unknown> = JSON.parse(bodyText);
    const headers = Object.fromEntries(req.headers.entries());

    const nodeReq: MiniRequest = {
      body,
      headers,
      method: "POST",
      url: req.url,
    };

    const nodeRes = new MiniResponseImpl();

    // Telegraf webhook handler
    await telegramWebhookHandler(
      nodeReq as unknown as Parameters<typeof telegramWebhookHandler>[0],
      nodeRes as unknown as Parameters<typeof telegramWebhookHandler>[1],
      () => {}
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Telegram webhook error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
