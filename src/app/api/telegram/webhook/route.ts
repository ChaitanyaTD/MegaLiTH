import { NextRequest, NextResponse } from "next/server";
import { bot } from "@/bot/webhook";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await bot.handleUpdate(body); // serverless-friendly

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Telegram webhook error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
