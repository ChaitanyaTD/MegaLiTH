import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { address } = await req.json();
  if (!address) return new Response("address required", { status: 400 });

  const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;
  if (!BOT_USERNAME) return new Response("bot username not configured", { status: 500 });

  const payload = encodeURIComponent(address);
  const startUrl = `https://t.me/${BOT_USERNAME}?start=${payload}`;

  return new Response(JSON.stringify({ startUrl }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
