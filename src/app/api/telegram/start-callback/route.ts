import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.STATE_SECRET)
    return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  // FIXED: Now accepting username
  const { payload: address, telegramId, username } = await req.json();
  
  if (!address || !telegramId)
    return new Response(JSON.stringify({ success: false, message: "Invalid body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });

  const user = await prisma.user.findUnique({ where: { address } });
  if (!user)
    return new Response(JSON.stringify({ success: false, message: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });

  // FIXED: Now updating username in the database
  await prisma.userProgress.upsert({
    where: { userId: user.id },
    update: { 
      telegramId, 
      tgState: 1,
      telegramUsername: username || null,
    },
    create: { 
      userId: user.id, 
      telegramId, 
      tgState: 1,
      telegramUsername: username || null,
    },
  });

  console.log(`✅ User linked: ${address} -> Telegram ID: ${telegramId}, Username: ${username || 'none'}`);

  return new Response(JSON.stringify({ success: true, message: "OK" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}