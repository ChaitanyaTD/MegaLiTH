import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
const db = prisma as any;

function generateCode(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function POST(req: NextRequest) {
  const { address } = await req.json();
  if (!address) return new Response("address required", { status: 400 });

  // Only proceed if the user already exists; do not create here
  const user = await db.user.findUnique({ where: { address } });
  if (!user) return new Response("user not found", { status: 404 });

  const record = await db.userProgress.upsert({
    where: { userId: user.id },
    update: {
      referralCode: generateCode(),
      refState: 1,
    },
    create: {
      userId: user.id,
      referralCode: generateCode(),
      xState: 1,
      tgState: 0,
      refState: 1,
    },
  });

  return new Response(JSON.stringify({ referralCode: record.referralCode }), { status: 200 });
}


