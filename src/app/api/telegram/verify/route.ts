import { NextRequest } from "next/server";
import { verifyTelegram } from "@/services/telegramService";

export async function POST(req: NextRequest) {
  const { address, telegramUserId } = await req.json();
  if (!address || !telegramUserId)
    return new Response("address and telegramUserId required", { status: 400 });

  try {
    const verified = await verifyTelegram(address, telegramUserId);
    return Response.json({ verified });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return new Response(message, { status: 400 });
  }
}
